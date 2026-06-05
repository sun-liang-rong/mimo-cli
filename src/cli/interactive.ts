import * as readline from 'readline';
import chalk from 'chalk';
import { MiMoClient, Message } from '../ai/client';
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
      this.conversation.startNewTurn();
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
    const messages = this.conversation.getMessages();
    const tools = this.toolRegistry.getDefinitions();
    
    this.renderer.startThinking();
    
    try {
      let shouldContinue = true;
      let fullResponse = '';
      
      while (shouldContinue) {
        fullResponse = '';
        
        console.log(chalk.cyan('\nMiMo: '));
        
        for await (const chunk of this.client.streamChat(messages, tools)) {
          this.renderer.stopThinking();
          this.renderer.writeChunk(chunk);
          fullResponse += chunk;
        }
        
        this.renderer.writeNewline();
        
        this.conversation.addMessage({
          role: 'assistant',
          content: fullResponse
        });
        
        shouldContinue = false;
      }
    } catch (error) {
      this.renderer.writeError(error instanceof Error ? error.message : String(error));
    }
  }
}
