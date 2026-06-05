import chalk from 'chalk';
import ora, { Ora } from 'ora';

export class StreamRenderer {
  private spinner: Ora | null = null;
  private buffer: string = '';

  startThinking(): void {
    this.spinner = ora({
      text: chalk.gray('思考中...'),
      color: 'cyan'
    }).start();
  }

  stopThinking(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  writeChunk(chunk: string): void {
    this.stopThinking();
    process.stdout.write(chunk);
    this.buffer += chunk;
  }

  writeNewline(): void {
    process.stdout.write('\n');
    this.buffer += '\n';
  }

  getBuffer(): string {
    return this.buffer;
  }

  clearBuffer(): void {
    this.buffer = '';
  }

  writeError(error: string): void {
    this.stopThinking();
    console.error(chalk.red(`\n错误: ${error}`));
  }

  writeSuccess(message: string): void {
    console.log(chalk.green(`\n✓ ${message}`));
  }

  writeInfo(message: string): void {
    console.log(chalk.blue(`\nℹ ${message}`));
  }

  writeWarning(message: string): void {
    console.log(chalk.yellow(`\n⚠ ${message}`));
  }
}