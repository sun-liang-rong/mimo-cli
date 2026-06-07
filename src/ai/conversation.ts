import { Message, ToolCall } from './client.js';
import { countMessagesTokens } from './token-counter.js';
import { getModelContextSize } from '../config/settings.js';

const DEFAULT_SYSTEM_PROMPT = `你是 MiMo，一个专业的 AI 编程助手，运行在终端环境中。

## 工具使用策略

### 何时使用工具
- 用户明确要求操作文件、执行命令、Git 操作时
- 需要读取代码来回答关于项目的问题时
- 需要修改、创建、搜索文件时

### 何时直接回答（不使用工具）
- 用户询问概念、原理、最佳实践等通用问题
- 用户问你的能力/技能，直接列出即可
- 闲聊、解释代码逻辑（无需读取文件）
- 用户已经提供了足够的上下文

### 工具选择优先级
1. \`read_file\` — 先读再改，不要盲写
2. \`edit_file\` — 优先用精确替换，而非 \`write_file\` 整文件覆盖
3. \`search_files\` — 不确定文件位置时先搜索
4. \`execute_command\` — 最后手段，优先用专用工具

## 任务执行模式 — Plan → Execute → Verify

对于复杂任务（涉及 3 个以上步骤），你必须：

### Step 1: 制定计划
在执行前，简要列出你的执行计划：
\`\`\`
📋 计划:
1. [步骤描述]
2. [步骤描述]
3. [步骤描述]
\`\`\`

### Step 2: 逐步执行
- 每一步都先确认前置条件（如文件是否存在）
- 修改文件前先读取当前内容
- 一次只做一个关键修改，不要一次改多处不相关的文件

### Step 3: 验证结果
- 修改完成后，读取修改后的文件确认变更正确
- 如果有测试，运行测试验证
- 如果验证失败，分析原因并重试（最多 3 次）

## 核心原则
1. **先理解再动手** — 不确定时先读取、搜索，而非猜测
2. **最小变更** — 只改需要改的，不做无关修改
3. **保持可逆** — 优先 edit_file 而非 write_file
4. **失败重试** — 工具调用失败时，分析错误原因并调整参数重试
5. **简洁输出** — 完成后给出简短总结，不要重复用户已知信息
6. **安全意识** — 不执行 rm -rf、force push 等破坏性操作`;

export interface ConversationOptions {
  systemPrompt?: string;
  maxContextTokens?: number;
  model?: string;
  projectContext?: string;
}

export class ConversationManager {
  private messages: Message[] = [];
  private systemPrompt: string;
  private maxContextTokens: number;
  private projectContext: string;
  private model: string;

  constructor(options?: ConversationOptions) {
    this.systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    this.model = options?.model || 'mimo-v2.5-pro';
    // Use provided maxContextTokens, or auto-detect from model, or default to 32000
    this.maxContextTokens = options?.maxContextTokens ?? getModelContextSize(this.model);
    this.projectContext = options?.projectContext || '';
  }

  addMessage(message: Message): void { this.messages.push(message); }

  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({ role: 'tool', tool_call_id: toolCallId, content: result });
  }

  addToolCall(toolCall: ToolCall): void {
    this.messages.push({ role: 'assistant', content: null, tool_calls: [toolCall] });
  }

  getMessages(): Message[] {
    let systemContent = this.systemPrompt;
    if (this.projectContext) systemContent += '\n\n' + this.projectContext;
    const systemMessage: Message = { role: 'system', content: systemContent };
    const allMessages = [systemMessage, ...this.messages];
    const totalTokens = countMessagesTokens(allMessages);
    if (totalTokens > this.maxContextTokens) {
      return this.validateMessages(this.truncateMessages(allMessages));
    }
    return this.validateMessages(allMessages);
  }

  private validateMessages(messages: Message[]): Message[] {
    const validated: Message[] = [];
    let pendingToolCallIds = new Set<string>();
    for (const msg of messages) {
      if (msg.role === 'system') { validated.push(msg); continue; }
      if (pendingToolCallIds.size > 0 && msg.role !== 'tool') pendingToolCallIds.clear();
      if (msg.role === 'assistant' && msg.tool_calls) {
        pendingToolCallIds = new Set(msg.tool_calls.map(tc => tc.id));
        validated.push(msg); continue;
      }
      if (msg.role === 'tool' && pendingToolCallIds.size > 0) {
        validated.push(msg);
        pendingToolCallIds.delete(msg.tool_call_id || '');
        continue;
      }
      if (msg.role === 'tool' && pendingToolCallIds.size === 0) continue;
      validated.push(msg);
    }
    return validated;
  }

  private truncateMessages(messages: Message[]): Message[] {
    if (messages.length <= 2) return messages;
    const system = messages[0];
    const rest = messages.slice(1);
    const kept: Message[] = [];
    let tokens = countMessagesTokens([system]);
    for (let i = rest.length - 1; i >= 0; i--) {
      const msgTokens = countMessagesTokens([rest[i]]);
      if (tokens + msgTokens > this.maxContextTokens * 0.9) break;
      tokens += msgTokens;
      kept.unshift(rest[i]);
    }
    if (kept.length < rest.length) {
      kept.unshift({ role: 'system', content: '[注意: 早期对话已被裁剪以适应上下文窗口]' });
    }
    return [system, ...kept];
  }

  clear(): void { this.messages = []; }
  getMessagesRaw(): Message[] { return this.messages; }
  setMessages(messages: Message[]): void { this.messages = messages; }
  getTurnCount(): number { return this.messages.filter(m => m.role === 'user').length; }

  getContextSummary() {
    const messages = this.getMessages();
    return { turns: this.getTurnCount(), tokens: countMessagesTokens(messages), maxTokens: this.maxContextTokens };
  }

  /**
   * Compact context by summarizing old turns.
   * Strategy: keep the most recent N messages raw, summarize the rest.
   */
  compact(): void {
    const msgs = this.messages;
    if (msgs.length <= 6) return; // too few to compact

    // Keep last 6 messages (3 turns) raw
    const recent = msgs.slice(-6);
    const old = msgs.slice(0, -6);

    // Build a summary of old messages
    let summary = '[之前的对话摘要]\n';
    for (const m of old) {
      if (m.role === 'user') {
        summary += `用户: ${(m.content || '').slice(0, 200)}\n`;
      } else if (m.role === 'assistant') {
        const text = m.content || '';
        if (text) summary += `助手: ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}\n`;
        if (m.tool_calls) {
          const names = m.tool_calls.map(tc => tc.function.name).join(', ');
          summary += `助手调用了工具: ${names}\n`;
        }
      } else if (m.role === 'tool') {
        const output = m.content || '';
        summary += `工具结果: ${output.slice(0, 150)}${output.length > 150 ? '...' : ''}\n`;
      }
    }

    this.messages = [
      { role: 'system', content: summary },
      ...recent,
    ];
  }

  /**
   * Smart compact: replace tool results with shorter versions,
   * merge consecutive assistant messages, remove verbose outputs.
   */
  smartCompact(): void {
    const msgs = this.messages;
    const compacted: Message[] = [];
    let i = 0;

    while (i < msgs.length) {
      const m = msgs[i];

      if (m.role === 'tool') {
        // Truncate long tool outputs aggressively
        const output = m.content || '';
        if (output.length > 300) {
          compacted.push({
            role: 'tool',
            tool_call_id: m.tool_call_id,
            content: output.slice(0, 300) + '\n...[已压缩]'
          });
        } else {
          compacted.push(m);
        }
        i++;
        continue;
      }

      if (m.role === 'assistant' && m.tool_calls) {
        // Keep tool call structure but trim arguments
        const trimmedCalls = m.tool_calls.map(tc => ({
          ...tc,
          function: {
            ...tc.function,
            arguments: tc.function.arguments.length > 200
              ? tc.function.arguments.slice(0, 200) + '...'
              : tc.function.arguments
          }
        }));
        compacted.push({
          role: 'assistant',
          content: m.content,
          tool_calls: trimmedCalls,
        });
        i++;
        continue;
      }

      if (m.role === 'assistant' && m.content) {
        // Truncate very long assistant text
        const text = m.content;
        if (text.length > 1000) {
          compacted.push({ role: 'assistant', content: text.slice(0, 1000) + '\n...[已压缩]' });
        } else {
          compacted.push(m);
        }
        i++;
        continue;
      }

      compacted.push(m);
      i++;
    }

    this.messages = compacted;
  }

  /** Export conversation history as markdown */
  exportHistory(): string {
    let md = '# MiMo CLI 对话历史\n\n';
    for (const msg of this.messages) {
      if (msg.role === 'user') md += `## 👤 用户\n${msg.content}\n\n`;
      else if (msg.role === 'assistant') md += `## 🤖 MiMo\n${msg.content || ''}\n\n`;
    }
    return md;
  }
}
