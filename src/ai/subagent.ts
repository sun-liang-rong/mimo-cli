import { EventEmitter } from 'events';
import { MiMoClient, ToolCall } from './client.js';
import { ConversationManager } from './conversation.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionManager } from '../security/permissions.js';
import { MemoryManager } from './memory.js';

export interface SubTask {
  id: string;
  description: string;
  fileScope: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

const MAX_CONCURRENT = 3;
let subtaskIdCounter = 0;

export class SubAgentManager extends EventEmitter {
  private tasks: Map<string, SubTask> = new Map();
  private runningCount = 0;

  constructor() {
    super();
  }

  /** Spawn a subtask — will execute in parallel if slots available */
  spawnSubTask(description: string, fileScope: string[]): SubTask {
    const task: SubTask = {
      id: `sub_${++subtaskIdCounter}`,
      description,
      fileScope,
      status: 'pending',
    };
    this.tasks.set(task.id, task);
    this.emit('subtask_created', { task });
    return task;
  }

  /** Execute a subtask using the provided agent infrastructure */
  async executeSubTask(
    task: SubTask,
    client: MiMoClient,
    toolRegistry: ToolRegistry,
    permissions: PermissionManager,
    memory: MemoryManager
  ): Promise<string> {
    if (this.runningCount >= MAX_CONCURRENT) {
      // Wait for a slot
      await new Promise<void>(resolve => {
        const check = () => {
          if (this.runningCount < MAX_CONCURRENT) resolve();
          else setTimeout(check, 500);
        };
        check();
      });
    }

    this.runningCount++;
    task.status = 'running';
    task.startedAt = Date.now();
    this.emit('subtask_started', { task });

    try {
      // Create a separate conversation for the subtask
      const context = memory.getAllContext(400);
      const conversation = new ConversationManager({
        maxContextTokens: 16000,
        projectContext: context,
      });

      // Add the task description as the first message
      conversation.addMessage({
        role: 'user',
        content: `子任务: ${task.description}\n只涉及以下文件: ${task.fileScope.join(", ")}\n完成后给出简要结果总结。`,
      });

      const messages = conversation.getMessages();
      const tools = toolRegistry.getDefinitions();

      // Single-turn execution (no agent loop, just one API call)
      let content = '';
      const toolCallBuffers: Map<number, ToolCall> = new Map();

      const stream = client.streamChat(messages, tools.length > 0 ? tools : undefined);

      for await (const chunk of stream) {
        if (chunk.type === 'content') content += chunk.data;
        if (chunk.type === 'tool_call_start' && chunk.toolCallIndex !== undefined) {
          toolCallBuffers.set(chunk.toolCallIndex, {
            id: chunk.toolCallId || '',
            type: 'function',
            function: { name: chunk.toolCallName || '', arguments: '' },
          });
        }
        if (chunk.type === 'tool_call_delta' && chunk.toolCallIndex !== undefined) {
          const buf = toolCallBuffers.get(chunk.toolCallIndex);
          if (buf) buf.function.arguments += chunk.data;
        }
      }

      // Execute any tool calls from the subtask
      const toolCalls = Array.from(toolCallBuffers.values());
      if (toolCalls.length > 0) {
        conversation.addMessage({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls,
        });

        for (const tc of toolCalls) {
          let args: Record<string, unknown>;
          try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

          // Only allow operations on files in the scope
          const pathArg = args.path as string | undefined;
          if (pathArg && !task.fileScope.some(f => pathArg.includes(f))) {
            conversation.addToolResult(tc.id, JSON.stringify({ success: false, output: '', error: '超出文件范围' }));
            continue;
          }

          const level = permissions.getPermissionLevel(tc.function.name, args);
          if (level === 'safe') {
            const result = await toolRegistry.execute(tc.function.name, args);
            conversation.addToolResult(tc.id, JSON.stringify(result));
          } else {
            conversation.addToolResult(tc.id, JSON.stringify({ success: false, output: '', error: '子任务中安全级别工具需要用户确认' }));
          }
        }

        // One more round to get the final summary
        const finalMessages = conversation.getMessages();
        const finalStream = client.streamChat(finalMessages, tools.length > 0 ? tools : undefined);
        let finalContent = '';
        for await (const chunk of finalStream) {
          if (chunk.type === 'content') finalContent += chunk.data;
        }
        content = finalContent || content;
      }

      task.result = content;
      task.status = 'completed';
      task.completedAt = Date.now();
      this.emit('subtask_completed', { task });
      return content;
    } catch (error) {
      task.error = error instanceof Error ? error.message : String(error);
      task.status = 'failed';
      task.completedAt = Date.now();
      this.emit('subtask_failed', { task, error: task.error });
      return task.error;
    } finally {
      this.runningCount--;
    }
  }

  /** Get all tasks */
  getTasks(): SubTask[] {
    return Array.from(this.tasks.values());
  }

  /** Get task by id */
  getTask(id: string): SubTask | undefined {
    return this.tasks.get(id);
  }

  /** Wait for all tasks to complete */
  async waitForAll(): Promise<SubTask[]> {
    const pending = this.getTasks().filter(t => t.status === 'running' || t.status === 'pending');
    // Poll until all done
    while (pending.some(t => this.tasks.get(t.id)?.status === 'running' || this.tasks.get(t.id)?.status === 'pending')) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return this.getTasks();
  }

  clear(): void {
    this.tasks.clear();
    this.runningCount = 0;
  }
}
