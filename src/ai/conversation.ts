import { Message, ToolCall } from './client';

export interface ConversationTurn {
  messages: Message[];
  toolCalls?: ToolCall[];
  toolResults?: Record<string, string>;
}

export class ConversationManager {
  private history: ConversationTurn[] = [];
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || `你是 MiMo，一个专业的 AI 编程助手。你可以帮助用户：
- 读取、写入和编辑文件
- 执行终端命令
- 进行 Git 操作
- 解答编程问题

请用中文回复，保持简洁专业。`;
  }

  addMessage(message: Message): void {
    if (this.history.length === 0) {
      this.history.push({ messages: [] });
    }
    this.history[this.history.length - 1].messages.push(message);
  }

  addToolCall(toolCall: ToolCall): void {
    if (this.history.length === 0) {
      this.history.push({ messages: [] });
    }
    const currentTurn = this.history[this.history.length - 1];
    if (!currentTurn.toolCalls) {
      currentTurn.toolCalls = [];
    }
    currentTurn.toolCalls.push(toolCall);
  }

  addToolResult(toolCallId: string, result: string): void {
    if (this.history.length === 0) {
      this.history.push({ messages: [] });
    }
    const currentTurn = this.history[this.history.length - 1];
    if (!currentTurn.toolResults) {
      currentTurn.toolResults = {};
    }
    currentTurn.toolResults[toolCallId] = result;
  }

  startNewTurn(): void {
    this.history.push({ messages: [] });
  }

  getMessages(): Message[] {
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt }
    ];

    for (const turn of this.history) {
      messages.push(...turn.messages);
      
      if (turn.toolCalls) {
        for (const tc of turn.toolCalls) {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [tc]
          } as any);
        }
      }
      
      if (turn.toolResults) {
        for (const [id, result] of Object.entries(turn.toolResults)) {
          messages.push({
            role: 'tool',
            tool_call_id: id,
            content: result
          } as any);
        }
      }
    }

    return messages;
  }

  clear(): void {
    this.history = [];
  }

  getHistory(): ConversationTurn[] {
    return [...this.history];
  }

  getTurnCount(): number {
    return this.history.length;
  }
}
