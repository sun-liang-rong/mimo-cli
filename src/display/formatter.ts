import chalk from 'chalk';

export function formatCode(code: string, language?: string): string {
  const lines = code.split('\n');
  const maxLineNum = lines.length.toString().length;
  
  return lines.map((line, i) => {
    const lineNum = chalk.gray((i + 1).toString().padStart(maxLineNum));
    return `${lineNum} │ ${line}`;
  }).join('\n');
}

export function formatDiff(diff: string): string {
  return diff.split('\n').map(line => {
    if (line.startsWith('+')) {
      return chalk.green(line);
    } else if (line.startsWith('-')) {
      return chalk.red(line);
    } else if (line.startsWith('@')) {
      return chalk.cyan(line);
    }
    return line;
  }).join('\n');
}

export function formatToolCall(name: string, args: Record<string, any>): string {
  const argsStr = Object.entries(args)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(', ');
  return chalk.yellow(`\n🔧 调用工具: ${name}(${argsStr})`);
}

export function formatToolResult(result: { success: boolean; output: string; error?: string }): string {
  if (result.success) {
    return chalk.green('✓ 工具执行成功') + (result.output ? `\n${result.output}` : '');
  } else {
    return chalk.red(`✗ 工具执行失败: ${result.error}`);
  }
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}