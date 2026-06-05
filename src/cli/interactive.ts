import * as readline from 'readline';
import chalk from 'chalk';
import { MiMoClient, Message, ToolCall } from '../ai/client';
import { ConversationManager } from '../ai/conversation';
import { StreamRenderer } from '../ai/streaming';
import { ToolRegistry } from '../tools/registry';
import { registerFileTools } from '../tools/file';
import { registerCommandTools } from '../tools/command';
import { registerGitTools } from '../tools/git';
import { formatToolCall, formatToolResult } from '../display/formatter';

export class InteractiveCLI {
  private client: MiMoClient;
  private conversation: ConversationManager;
  private renderer: StreamRenderer;
  private toolRegistry: ToolRegistry;
  private rl: readline.Interface;

  constructor() {
    this.client = new MiMoClient();
    this.conversation = new ConversationManager();
    this.renderer = new StreamRenderer();
    this.toolRegistry = new ToolRegistry();

    registerFileTools(this.toolRegistry);
    registerCommandTools(this.toolRegistry);
    registerGitTools(this.toolRegistry);

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start(): Promise<void> {
    console.log(chalk.cyan('╔═══════════════════════════════════════╗'));
    console.log(chalk.cyan('║        MiMo CLI - AI 编程助手         ║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════╝'));
    console.log(chalk.gray('输入 /help 查看帮助，输入 /quit 退出\n'));

    process.on('SIGINT', () => {
      console.log(chalk.cyan('\n\n再见！'));
      this.rl.close();
      process.exit(0);
    });

    await this.chatLoop();
  }

  private async chatLoop(): Promise<void> {
    while (true) {
      const input = await this.prompt();

      if (input.startsWith('/')) {
        const shouldExit = await this.handleCommand(input);
        if (shouldExit) break;
        continue;
      }

      if (!input.trim()) continue;

      this.conversation.addMessage({
        role: 'user',
        content: input
      });

      await this.processAIResponse();
    }
  }

  private prompt(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.green('You: '), resolve);
    });
  }

  private async handleCommand(command: string): Promise<boolean> {
    const cmd = command.toLowerCase().trim();

    switch (cmd) {
      case '/quit':
      case '/exit':
        console.log(chalk.cyan('\n再见！'));
        this.rl.close();
        return true;

      case '/clear':
        this.conversation.clear();
        console.clear();
        console.log(chalk.gray('对话历史已清空\n'));
        return false;

      case '/help':
        this.showHelp();
        return false;

      case '/tools':
        this.showTools();
        return false;

      default:
        console.log(chalk.yellow(`未知命令: ${command}`));
        return false;
    }
  }

  private showHelp(): void {
    console.log(chalk.cyan('\n可用命令:'));
    console.log('  /help   - 显示帮助');
    console.log('  /clear  - 清空对话历史');
    console.log('  /tools  - 显示可用工具');
    console.log('  /quit   - 退出程序\n');
  }

  private showTools(): void {
    console.log(chalk.cyan('\n可用工具:'));
    const tools = this.toolRegistry.getToolNames();
    tools.forEach(tool => {
      console.log(chalk.yellow(`  - ${tool}`));
    });
    console.log();
  }

  private async processAIResponse(): Promise<void> {
    this.renderer.startThinking();

    try {
      let hasToolCalls = true;

      while (hasToolCalls) {
        const messages = this.conversation.getMessages();
        const tools = this.toolRegistry.getDefinitions();

        // Debug: log messages
        console.log(chalk.gray('\n[DEBUG] Messages count: ' + messages.length));
        console.log(chalk.gray('[DEBUG] Last 3 messages:'));
        const last3 = messages.slice(-3);
        for (const m of last3) {
          console.log(chalk.gray(`  role=${m.role}, content=${m.content?.substring(0, 50)}, tool_calls=${(m as any).tool_calls?.length || 0}, tool_call_id=${(m as any).tool_call_id || 'none'}`));
        }

        const response = await this.client.chat(messages, tools);
        this.renderer.stopThinking();

        if (response.content) {
          console.log(chalk.cyan('\nMiMo: ') + response.content);
        }

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Add assistant message with tool_calls
          this.conversation.addMessage({
            role: 'assistant',
            content: response.content || null,
            tool_calls: response.toolCalls
          } as any);

          // Execute each tool and add results
          for (const toolCall of response.toolCalls) {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(formatToolCall(toolCall.function.name, args));

            const result = await this.toolRegistry.execute(toolCall.function.name, args);
            console.log(formatToolResult(result));

            this.conversation.addToolResult(toolCall.id, JSON.stringify(result));
          }
        } else {
          // No tool calls, just add the assistant message
          if (response.content) {
            this.conversation.addMessage({
              role: 'assistant',
              content: response.content
            });
          }
          hasToolCalls = false;
        }
      }
    } catch (error) {
      this.renderer.stopThinking();
      this.renderer.writeError(error instanceof Error ? error.message : String(error));
    }
  }
}
