import { Message, ToolCall } from './client';

export class ConversationManager {
  private messages: Message[] = [];
  private systemPrompt: string;

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || `你是 MiMo，一个专业的 AI 编程助手。你可以帮助用户：
- 读取、写入和编辑文件
- 执行终端命令
- 进行 Git 操作
- 解答编程问题

请用中文回复，保持简洁专业。`;
    this.messages = [];
  }

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  addToolCall(toolCall: ToolCall): void {
    this.messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [toolCall]
    } as any);
  }

  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      content: result
    } as any);
  }

  startNewTurn(): void {
    // No-op, we just keep adding messages
  }

  getMessages(): Message[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...this.messages
    ];
  }

  clear(): void {
    this.messages = [];
  }

  getTurnCount(): number {
    return this.messages.filter(m => m.role === 'user').length;
  }
}
