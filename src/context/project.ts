import * as fs from 'fs';
import * as path from 'path';

export interface ProjectInfo {
  type: string;
  name: string;
  description: string;
  language: string;
  scripts: Record<string, string>;
  structure: string;
}

function detectProjectType(dir: string): { type: string; language: string } {
  if (fs.existsSync(path.join(dir, 'package.json'))) return { type: 'node', language: 'TypeScript/JavaScript' };
  if (fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'setup.py'))) return { type: 'python', language: 'Python' };
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return { type: 'rust', language: 'Rust' };
  if (fs.existsSync(path.join(dir, 'go.mod'))) return { type: 'go', language: 'Go' };
  if (fs.existsSync(path.join(dir, 'pom.xml'))) return { type: 'java', language: 'Java' };
  return { type: 'unknown', language: 'Unknown' };
}

function getDirectoryTree(dir: string, prefix = '', maxDepth = 2, currentDepth = 0): string {
  if (currentDepth >= maxDepth) return '';
  const ignore = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', 'target', '.mimo', '.jest-cache']);
  let result = '';
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => !ignore.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      result += `${prefix}${connector}${entry.name}${entry.isDirectory() ? '/' : ''}\n`;
      if (entry.isDirectory()) {
        const subPrefix = prefix + (isLast ? '    ' : '│   ');
        result += getDirectoryTree(path.join(dir, entry.name), subPrefix, maxDepth, currentDepth + 1);
      }
    }
  } catch { /* skip */ }
  return result;
}

export function detectProject(dir = process.cwd()): ProjectInfo {
  const { type, language } = detectProjectType(dir);
  let name = path.basename(dir);
  let description = '';
  let scripts: Record<string, string> = {};
  if (type === 'node') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
      name = pkg.name || name;
      description = pkg.description || '';
      scripts = pkg.scripts || {};
    } catch { /* skip */ }
  }
  const structure = getDirectoryTree(dir);
  return { type, name, description, language, scripts, structure };
}

/**
 * 轻量项目摘要 — 只包含基本信息，不注入完整目录树。
 * 目录树信息只在 AI 主动使用 list_files 等工具时获取。
 */
export function getProjectSummary(dir = process.cwd()): string {
  const info = detectProject(dir);
  let summary = `## 当前项目\n`;
  summary += `- 项目名: ${info.name}\n`;
  summary += `- 类型: ${info.type} (${info.language})\n`;
  if (info.description) summary += `- 描述: ${info.description}\n`;
  if (Object.keys(info.scripts).length > 0) {
    summary += `- 可用脚本: ${Object.entries(info.scripts).map(([k, v]) => `${k}(${v})`).join(', ')}\n`;
  }
  return summary;
}

/**
 * 完整项目上下文（含目录树），用于需要深入了解项目时手动调用。
 */
export function getFullProjectContext(dir = process.cwd()): string {
  const info = detectProject(dir);
  let summary = `## 当前项目\n`;
  summary += `- 项目名: ${info.name}\n`;
  summary += `- 类型: ${info.type} (${info.language})\n`;
  if (info.description) summary += `- 描述: ${info.description}\n`;
  if (Object.keys(info.scripts).length > 0) {
    summary += `- 可用脚本:\n`;
    for (const [name, cmd] of Object.entries(info.scripts)) {
      summary += `  - \`${name}\`: ${cmd}\n`;
    }
  }
  if (info.structure) {
    summary += `\n## 目录结构\n\`\`\`\n${info.structure}\`\`\`\n`;
  }
  return summary;
}
