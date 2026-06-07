import { EventEmitter } from 'events';
import { MiMoClient, ToolCall, ChatResponse, Message } from './client.js';
import { ConversationManager } from './conversation.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionManager } from '../security/permissions.js';
import { PlanEngine, Plan } from './planner.js';
import { TodoManager } from './todo.js';
import { MemoryManager } from './memory.js';
import { CodeGraphBuilder } from './codegraph.js';
import { SubAgentManager } from './subagent.js';
import { LongTaskRunner } from './longtask.js';
import { CostController } from './cost.js';
import { CallChainEntry } from '../components/CallChainView.js';
import { getErrorMessage } from '../utils/errors.js';

export interface AgentEvents {
  stream_start: {};
  stream_delta: { content: string };
  stream_end: { content: string };
  tool_call_start: { toolCall: ToolCall; args: Record<string, unknown>; duration?: number };
  tool_call_result: { toolCall: ToolCall; result: { success: boolean; output: string; error?: string }; duration: number };
  tool_confirm: { toolCall: ToolCall; args: Record<string, unknown>; level: string };
  thinking: {};
  thinking_phase: { phase: 'planning' | 'executing' | 'verifying' | 'fixing' };
  done: { content: string };
  error: { message: string };
  auto_compact: { reason: string };
  plan_created: { plan: Plan };
  plan_confirmed: { plan: Plan };
  plan_done: { plan: Plan };
  subtask_started: { task: unknown };
  subtask_completed: { task: unknown; result: string };
  subtask_failed: { task: unknown; error: string };
  cost_update: { cost: number; tokens: number };
}

const MAX_TOOL_ROUNDS = 30;
const MAX_OUTPUT_LENGTH = 8000;
const TOOL_RETRY_MAX = 3;
const CONTEXT_COMPACT_THRESHOLD = 0.75;
const ERROR_FIX_MAX = 3;

export class AgentLoop extends EventEmitter {
  private client: MiMoClient;
  private conversation: ConversationManager;
  private toolRegistry: ToolRegistry;
  private permissions: PermissionManager;
  private planner: PlanEngine;
  private todo: TodoManager;
  private memory: MemoryManager;
  private codeGraph: CodeGraphBuilder;
  private subAgent: SubAgentManager;
  private longTask: LongTaskRunner;
  private cost: CostController;
  private aborted = false;
  private confirmResolver: ((approved: boolean) => void) | null = null;
  private callChain: CallChainEntry[] = [];
  private currentPhase: 'planning' | 'executing' | 'verifying' | 'fixing' = 'executing';

  constructor(
    client: MiMoClient,
    conversation: ConversationManager,
    toolRegistry: ToolRegistry,
    permissions: PermissionManager,
    planner: PlanEngine,
    todo: TodoManager,
    memory: MemoryManager,
    codeGraph: CodeGraphBuilder,
    subAgent: SubAgentManager,
    longTask: LongTaskRunner,
    cost: CostController
  ) {
    super();
    this.client = client;
    this.conversation = conversation;
    this.toolRegistry = toolRegistry;
    this.permissions = permissions;
    this.planner = planner;
    this.todo = todo;
    this.memory = memory;
    this.codeGraph = codeGraph;
    this.subAgent = subAgent;
    this.longTask = longTask;
    this.cost = cost;
  }

  abort(): void {
    this.aborted = true;
    if (this.confirmResolver) { this.confirmResolver(false); this.confirmResolver = null; }
  }

  resolveConfirm(approved: boolean): void {
    if (this.confirmResolver) { this.confirmResolver(approved); this.confirmResolver = null; }
  }

  getCallChain(): CallChainEntry[] { return this.callChain; }
  getPlanner(): PlanEngine { return this.planner; }
  getTodo(): TodoManager { return this.todo; }
  getMemory(): MemoryManager { return this.memory; }
  getCost(): CostController { return this.cost; }
  getPermissions(): PermissionManager { return this.permissions; }
  getConversation(): ConversationManager { return this.conversation; }
  getToolRegistry(): ToolRegistry { return this.toolRegistry; }
  getCodeGraph(): CodeGraphBuilder { return this.codeGraph; }

  /** Generate a plan first, then execute */
  async executePlanMode(userMessage: string): Promise<Plan | null> {
    this.aborted = false;
    this.currentPhase = 'planning';
    this.emit('thinking_phase', { phase: 'planning' });
    this.emit('thinking');

    // Add user message
    this.conversation.addMessage({ role: 'user', content: userMessage });

    // Ask AI to generate a plan (single non-streaming call)
    const planPrompt = this.conversation.getMessages();
    const planInstruction: Message = { role: 'system', content: '请先制定一个执行计划，列出步骤编号和描述。格式：1. 步骤描述\n2. 步骤描述\n...\n\n不要执行任何操作，只列出计划。' };
    const messagesWithPlan = [...planPrompt, planInstruction];

    try {
      const response = await this.client.chat(messagesWithPlan);
      const plan = this.planner.parsePlanFromText(response.content, userMessage.slice(0, 50));
      if (plan) {
        this.emit('plan_created', { plan });
        return plan;
      }
      // If no plan parsed, just execute normally
      return null;
    } catch (err) {
      this.emit('error', { message: getErrorMessage(err) });
      return null;
    }
  }

  /** Execute a confirmed plan step by step */
  async executeConfirmedPlan(plan: Plan): Promise<string> {
    this.aborted = false;
    this.planner.startExecution();
    this.currentPhase = 'executing';
    this.emit('thinking_phase', { phase: 'executing' });

    // Convert to todo list
    this.todo.importFromPlan(plan.items);

    // Track as long task if needed
    if (LongTaskRunner.isLongTask(plan)) {
      this.longTask.startFromPlan(plan);
    }

    let lastContent = '';

    for (const item of plan.items) {
      if (this.aborted) break;
      if (item.status === 'completed' || item.status === 'skipped') continue;

      this.planner.startStep(item.id);
      this.todo.start(this.todo.list().find(t => t.text === item.step)?.id || '');

      this.emit('thinking');
      this.emit('thinking_phase', { phase: 'executing' });

      // Execute the step — add a focused message
      this.conversation.addMessage({
        role: 'user',
        content: `执行计划步骤 "${item.step}"`,
      });

      // Check context
      this.checkAndAutoCompact();

      try {
        lastContent = await this.runAgentLoop();
      } catch (err) {
        const errMsg = getErrorMessage(err);
        this.planner.failStep(item.id, errMsg);
        this.emit('error', { message: errMsg });
        break;
      }

      // Mark step as completed
      this.planner.completeStep(item.id, lastContent.slice(0, 100));
      const todoItem = this.todo.list().find(t => t.text === item.step);
      if (todoItem) this.todo.done(todoItem.id);

      // Update long task progress
      if (this.longTask.getProgress()) {
        const progress = this.planner.getProgress();
        this.longTask.updateStep(plan.items.findIndex(i => i.id === item.id), item.step, progress.completed);
      }
    }

    // Verify phase
    this.currentPhase = 'verifying';
    this.planner.setVerifying();
    this.emit('thinking_phase', { phase: 'verifying' });

    this.emit('done', { content: lastContent });
    this.longTask.complete();
    return lastContent;
  }

  /** Normal execution without plan */
  async executeTask(userMessage: string): Promise<string> {
    this.aborted = false;
    this.conversation.addMessage({ role: 'user', content: userMessage });

    // Extract memory from user message
    this.memory.extractAndStore('user', userMessage);

    const result = await this.runAgentLoop();
    this.emit('done', { content: result });
    return result;
  }

  /** Core agent loop — shared by both plan and normal execution */
  private async runAgentLoop(): Promise<string> {
    let lastContent = '';
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS && !this.aborted) {
      rounds++;
      this.checkAndAutoCompact();

      const messages = this.conversation.getMessages();
      const tools = this.toolRegistry.getDefinitions();

      this.emit('thinking');
      let content = '';
      const toolCallBuffers: Map<number, ToolCall> = new Map();
      let toolCalls: ToolCall[] = [];

      try {
        const stream = this.client.streamChat(messages, tools.length > 0 ? tools : undefined);
        this.emit('stream_start');

        for await (const chunk of stream) {
          if (this.aborted) break;
          switch (chunk.type) {
            case 'content':
              content += chunk.data;
              this.emit('stream_delta', { content: chunk.data });
              break;
            case 'tool_call_start':
              if (chunk.toolCallIndex !== undefined) {
                toolCallBuffers.set(chunk.toolCallIndex, {
                  id: chunk.toolCallId || '',
                  type: 'function',
                  function: { name: chunk.toolCallName || '', arguments: '' },
                });
              }
              break;
            case 'tool_call_delta':
              if (chunk.toolCallIndex !== undefined && toolCallBuffers.has(chunk.toolCallIndex)) {
                toolCallBuffers.get(chunk.toolCallIndex)!.function.arguments += chunk.data;
              }
              break;
          }
        }

        toolCalls = Array.from(toolCallBuffers.values());
        this.emit('stream_end', { content });
      } catch (err) {
        this.emit('error', { message: getErrorMessage(err) });
        break;
      }

      if (content) lastContent = content;

      // Extract memory from assistant message
      this.memory.extractAndStore('assistant', content);

      if (toolCalls.length > 0) {
        this.conversation.addMessage({ role: 'assistant', content: content || null, tool_calls: toolCalls });

        // Categorize tool calls
        const safeCalls: { toolCall: ToolCall; args: Record<string, unknown> }[] = [];
        const confirmCalls: { toolCall: ToolCall; args: Record<string, unknown> }[] = [];

        for (const toolCall of toolCalls) {
          let args: Record<string, unknown>;
          try { args = JSON.parse(toolCall.function.arguments); } catch { args = {}; }
          const level = this.permissions.getPermissionLevel(toolCall.function.name, args);

          if (level === 'safe') safeCalls.push({ toolCall, args });
          else confirmCalls.push({ toolCall, args });
        }

        // Execute safe tools in parallel
        if (safeCalls.length > 0) {
          await Promise.all(safeCalls.map(async ({ toolCall, args }) => {
            if (this.aborted) return { toolCall, result: { success: false, output: '', error: 'aborted' }, duration: 0 };
            this.emit('tool_call_start', { toolCall, args });
            const startTime = Date.now();
            const result = await this.executeWithRetryAndFix(toolCall, args);
            const duration = Date.now() - startTime;
            this.emit('tool_call_result', { toolCall, result, duration });
            this.conversation.addToolResult(toolCall.id, JSON.stringify(result));
            this.permissions.audit(toolCall.function.name, args, true, 'safe');
            this.callChain.push({ id: toolCall.id, toolName: toolCall.function.name, args, status: result.success ? 'completed' : 'failed', duration, timestamp: startTime });
            // Update code graph if file was modified
            if (['write_file', 'edit_file', 'apply_patch'].includes(toolCall.function.name)) {
              this.codeGraph.updateFiles(args.path ? [String(args.path)] : []);
            }
            this.memory.extractAndStore('tool', result.output || result.error || '');
            return { toolCall, result, duration };
          }));
        }

        // Execute confirm-level tools sequentially
        for (const { toolCall, args } of confirmCalls) {
          if (this.aborted) break;
          const level = this.permissions.getPermissionLevel(toolCall.function.name, args);
          this.emit('tool_call_start', { toolCall, args });
          this.emit('tool_confirm', { toolCall, args, level });

          const startTime = Date.now();
          const approved = await new Promise<boolean>(resolve => { this.confirmResolver = resolve; });
          this.permissions.audit(toolCall.function.name, args, approved);

          if (!approved) {
            const denyResult = { success: false, output: '', error: '用户拒绝执行' };
            this.conversation.addToolResult(toolCall.id, JSON.stringify(denyResult));
            this.emit('tool_call_result', { toolCall, result: denyResult, duration: Date.now() - startTime });
            continue;
          }

          const result = await this.executeWithRetryAndFix(toolCall, args);
          const duration = Date.now() - startTime;
          this.conversation.addToolResult(toolCall.id, JSON.stringify(result));
          this.emit('tool_call_result', { toolCall, result, duration });
          this.callChain.push({ id: toolCall.id, toolName: toolCall.function.name, args, status: result.success ? 'completed' : 'failed', duration, timestamp: startTime });
          if (['write_file', 'edit_file', 'apply_patch'].includes(toolCall.function.name)) {
            this.codeGraph.updateFiles(args.path ? [String(args.path)] : []);
          }
          this.memory.extractAndStore('tool', result.output || result.error || '');
        }

        continue;
      } else {
        if (content) this.conversation.addMessage({ role: 'assistant', content });
        break;
      }
    }

    return lastContent;
  }

  /** Execute tool with retry + auto-fix */
  private async executeWithRetryAndFix(toolCall: ToolCall, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> {
    const toolName = toolCall.function.name;

    for (let attempt = 0; attempt <= ERROR_FIX_MAX; attempt++) {
      if (this.aborted) return { success: false, output: '', error: 'aborted' };
      const result = await this.toolRegistry.execute(toolName, args);

      if (result.success) {
        let outputStr = result.output || '';
        if (outputStr.length > MAX_OUTPUT_LENGTH) {
          outputStr = outputStr.slice(0, MAX_OUTPUT_LENGTH) + `\n... (已截断)`;
        }
        return { ...result, output: outputStr };
      }

      // Don't retry definitive errors
      const errMsg = result.error || '';
      if (errMsg.includes('文件不存在') || errMsg.includes('多处匹配') || errMsg.includes('未找到匹配')) {
        return result;
      }

      if (attempt >= ERROR_FIX_MAX) return result;

      // Auto-fix: edit_file match failure → read file for context
      if (toolName === 'edit_file' && (errMsg.includes('未找到') || errMsg.includes('未匹配'))) {
        this.currentPhase = 'fixing';
        this.emit('thinking_phase', { phase: 'fixing' });
        const readResult = await this.toolRegistry.execute('read_file', { path: args.path });
        if (readResult.success) {
          // Provide context in the next round — the agent loop will handle it
          this.conversation.addToolResult(toolCall.id, JSON.stringify({
            ...result,
            fixHint: `未能匹配。文件当前内容（前30行):\n${readResult.output.split('\n').slice(0, 30).join('\n')}`,
          }));
          return result; // Return original error, but context is now available
        }
      }

      // Command timeout → increase timeout
      if (errMsg.includes('超时') || errMsg.includes('timeout')) {
        args.timeout = Math.min((args.timeout as number || 30000) * 2, 300000);
      }

      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }

    return { success: false, output: '', error: '重试次数已用尽' };
  }

  private checkAndAutoCompact(): void {
    const summary = this.conversation.getContextSummary();
    const usageRatio = summary.tokens / summary.maxTokens;
    if (usageRatio > CONTEXT_COMPACT_THRESHOLD) {
      this.emit('auto_compact', { reason: `上下文 ${Math.round(usageRatio * 100)}%，自动压缩` });
      this.conversation.smartCompact();
    }

    // Check budget
    if (this.cost.shouldPause()) {
      this.emit('error', { message: '已达到预算上限，暂停执行' });
      this.aborted = true;
    }
  }
}
