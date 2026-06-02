import fs from 'fs';
import path from 'path';
import * as Diff from 'diff';
import { checkPathSafety } from '../utils/safety';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';

/** 已读取文件的缓存（用于 diff） */
const fileCache: Map<string, string> = new Map();

// ── 工具定义 ──

const readFileDef: ToolDefinition = {
  name: 'read_file',
  description: '读取本地文本文件内容，返回文件内容',
  permission: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对或绝对）' },
    },
    required: ['path'],
  },
};

const writeFileDef: ToolDefinition = {
  name: 'write_file',
  description: '创建或覆盖写入本地文件',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '要写入的文件内容' },
    },
    required: ['path', 'content'],
  },
};

const editFileDef: ToolDefinition = {
  name: 'edit_file',
  description: '精确替换文件中的指定字符串（局部编辑）',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      old_string: { type: 'string', description: '要替换的原始文本（必须精确匹配）' },
      new_string: { type: 'string', description: '替换后的新文本' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

const diffFileDef: ToolDefinition = {
  name: 'diff_file',
  description: '查看文件修改前后的差异对比',
  permission: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
    },
    required: ['path'],
  },
};

// ── 工具实现 ──

function handleReadFile(args: Record<string, unknown>): ToolResult {
  const filePath = String(args.path);
  const resolved = path.resolve(filePath);

  const safetyError = checkPathSafety(resolved);
  if (safetyError) return { success: false, output: '', error: safetyError };

  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      // 列出目录内容
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const listing = entries
        .map((e) => `${e.isDirectory() ? '[DIR] ' : '      '}${e.name}`)
        .join('\n');
      return { success: true, output: `目录 ${resolved}:\n${listing}` };
    }
    if (stat.size > 1024 * 1024) {
      return { success: false, output: '', error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），限制 1MB` };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    fileCache.set(resolved, content);
    return { success: true, output: content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `读取失败: ${msg}` };
  }
}

function handleWriteFile(args: Record<string, unknown>): ToolResult {
  const filePath = String(args.path);
  const content = String(args.content);
  const resolved = path.resolve(filePath);

  const safetyError = checkPathSafety(resolved);
  if (safetyError) return { success: false, output: '', error: safetyError };

  try {
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, content, 'utf-8');
    return { success: true, output: `文件已写入: ${resolved}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `写入失败: ${msg}` };
  }
}

function handleEditFile(args: Record<string, unknown>): ToolResult {
  const filePath = String(args.path);
  const oldString = String(args.old_string);
  const newString = String(args.new_string);
  const resolved = path.resolve(filePath);

  const safetyError = checkPathSafety(resolved);
  if (safetyError) return { success: false, output: '', error: safetyError };

  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    const count = content.split(oldString).length - 1;
    if (count === 0) {
      return { success: false, output: '', error: `未找到要替换的文本，请确保 old_string 精确匹配文件内容` };
    }
    if (count > 1) {
      return { success: false, output: '', error: `找到 ${count} 处匹配，请提供更多上下文使 old_string 唯一` };
    }

    const updated = content.replace(oldString, newString);
    fileCache.set(resolved, content); // 缓存旧版本用于 diff
    fs.writeFileSync(resolved, updated, 'utf-8');
    return { success: true, output: `文件已编辑: ${resolved}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `编辑失败: ${msg}` };
  }
}

function handleDiffFile(args: Record<string, unknown>): ToolResult {
  const filePath = String(args.path);
  const resolved = path.resolve(filePath);

  const oldContent = fileCache.get(resolved);
  if (oldContent === undefined) {
    return { success: false, output: '', error: `没有 ${resolved} 的历史缓存，请先 read_file 读取后再修改` };
  }

  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  const newContent = fs.readFileSync(resolved, 'utf-8');
  if (oldContent === newContent) {
    return { success: true, output: '文件没有变更' };
  }

  const patch = Diff.createPatch(path.basename(resolved), oldContent, newContent);
  return { success: true, output: patch };
}

// ── 注册工具 ──

export function registerFileTools(): void {
  toolRegistry.register(readFileDef, handleReadFile);
  toolRegistry.register(writeFileDef, handleWriteFile);
  toolRegistry.register(editFileDef, handleEditFile);
  toolRegistry.register(diffFileDef, handleDiffFile);
}

// ── 保留旧接口兼容 slash 命令 ──

export function readFile(filePath: string): { success: boolean; content?: string; error?: string } {
  const result = handleReadFile({ path: filePath });
  return { success: result.success, content: result.output || undefined, error: result.error };
}

export function writeFile(filePath: string, content: string): { success: boolean; error?: string } {
  const result = handleWriteFile({ path: filePath, content });
  return { success: result.success, error: result.error };
}

export function showDiff(filePath: string): { success: boolean; diff?: string; error?: string } {
  const result = handleDiffFile({ path: filePath });
  return { success: result.success, diff: result.output || undefined, error: result.error };
}

export function getLanguageFromExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.py': 'python', '.java': 'java', '.go': 'go',
    '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c',
    '.cs': 'csharp', '.swift': 'swift', '.kt': 'kotlin',
    '.html': 'html', '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
    '.md': 'markdown', '.sh': 'bash', '.sql': 'sql',
    '.xml': 'xml', '.toml': 'toml', '.vue': 'vue',
  };
  return map[ext] || 'text';
}
