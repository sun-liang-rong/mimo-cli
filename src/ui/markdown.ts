// src/ui/markdown.ts

import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// 配置 marked-terminal 渲染器
const terminalRenderer = new TerminalRenderer({
  width: 80,
  showSectionPrefix: false,
  reflowText: false,
});

marked.setOptions({
  renderer: terminalRenderer,
});

/**
 * 将 Markdown 文本渲染为 ANSI 彩色终端文本
 */
export function renderMarkdown(text: string): string {
  try {
    const result = marked.parse(text);
    // marked.parse 可能返回 string 或 Promise<string>
    // 同步模式下返回 string
    if (typeof result === 'string') {
      return result;
    }
    // 如果返回 Promise (unlikely with sync marked), 回退到原文
    return text;
  } catch {
    // 渲染失败时返回原文
    return text;
  }
}

/**
 * 检测文本是否包含 Markdown 特征
 */
export function hasMarkdown(text: string): boolean {
  return /```|`[^`]+`|\*\*|__|\[.*\]\(|^#{1,6}\s/m.test(text);
}