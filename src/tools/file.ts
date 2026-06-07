import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler, ToolResult } from './types.js';
import { ToolRegistry } from './registry.js';
import { ToolError } from '../utils/errors.js';

const BACKUP_DIR = '.mimo-backup';

function backupFile(filePath: string): void {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return;
    const content = fs.readFileSync(absPath, 'utf-8');
    const backupPath = path.join(
      path.dirname(absPath),
      BACKUP_DIR,
      Date.now().toString() + '-' + path.basename(absPath)
    );
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, content);
  } catch { /* best effort */ }
}


// ==================== read_file ====================
export const readFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: '读取文件内容。修改文件前应先调用此工具查看当前内容。支持按行号范围读取大文件的部分内容。',
    parameters: {
      type: 'object', description: '文件路径参数',
      properties: {
        path: { type: 'string', description: '文件路径（相对于当前工作目录或绝对路径）' },
        offset: { type: 'number', description: '起始行号（从1开始），省略则从头开始' },
        limit: { type: 'number', description: '读取行数，省略则读取全部' }
      },
      required: ['path']
    }
  }
};

export const readFileHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const filePath = path.resolve(args.path as string);
    if (!fs.existsSync(filePath)) {
      return { success: false, output: '', error: `文件不存在: ${args.path}` };
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      return { success: false, output: '', error: `${args.path} 是目录，不是文件。请使用 list_files 列出目录内容。` };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const start = args.offset ? Math.max(1, args.offset as number) - 1 : 0;
    const limit = args.limit as number || lines.length;
    const selected = lines.slice(start, start + limit);
    const totalLines = lines.length;
    const output = selected.map((line, i) => `${(start + i + 1).toString().padStart(4)}│ ${line}`).join('\n');
    const header = totalLines > limit ? `文件共 ${totalLines} 行，显示第 ${start + 1}-${Math.min(start + limit, totalLines)} 行\n` : '';
    return { success: true, output: header + output };
  } catch (error) {
    return { success: false, output: '', error: `无法读取文件: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// ==================== write_file ====================
export const writeFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: '创建新文件或完全覆盖已有文件。对于已有文件的修改，优先使用 edit_file 精确替换而非整体覆盖。',
    parameters: {
      type: 'object', description: '文件写入参数',
      properties: {
        path: { type: 'string', description: '文件路径' },
        content: { type: 'string', description: '要写入的完整文件内容' }
      },
      required: ['path', 'content']
    }
  }
};

export const writeFileHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const filePath = path.resolve(args.path as string);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const isNew = !fs.existsSync(filePath);
    backupFile(args.path as string);
    fs.writeFileSync(filePath, args.content as string, 'utf-8');
    const lineCount = (args.content as string).split('\n').length;
    return { success: true, output: `${isNew ? '已创建' : '已写入'}文件: ${args.path} (${lineCount} 行)` };
  } catch (error) {
    return { success: false, output: '', error: `无法写入文件: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// ==================== edit_file ====================
export const editFileTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: '精确替换文件中的内容。必须先用 read_file 查看文件当前内容，然后提供需要替换的确切文本。old_string 必须与文件内容完全匹配（包括空格、缩进、换行符）。',
    parameters: {
      type: 'object', description: '文件编辑参数',
      properties: {
        path: { type: 'string', description: '文件路径' },
        old_string: { type: 'string', description: '要替换的原始文本（必须与文件内容精确匹配，包括缩进）' },
        new_string: { type: 'string', description: '替换后的新文本' }
      },
      required: ['path', 'old_string', 'new_string']
    }
  }
};

export const editFileHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const filePath = path.resolve(args.path as string);
    if (!fs.existsSync(filePath)) return { success: false, output: '', error: `文件不存在: ${args.path}。如需创建新文件，请使用 write_file。` };
    const content = fs.readFileSync(filePath, 'utf-8');
    const count = content.split(args.old_string as string).length - 1;
    if (count === 0) {
      // Provide helpful diagnostics
      const lines = content.split('\n');
      const oldLines = (args.old_string as string).split('\n');
      const firstOldLine = oldLines[0]?.trim();
      let nearMatches = '';
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(firstOldLine) || lines[i].trim() === firstOldLine) {
          nearMatches += `  第 ${i + 1} 行: ${lines[i].slice(0, 100)}\n`;
        }
      }
      let hint = '未找到匹配的文本。请确保 old_string 与文件内容完全一致（注意空格、缩进、换行符）。';
      if (nearMatches) hint += `\n可能的近似匹配:\n${nearMatches}`;
      return { success: false, output: '', error: hint };
    }
    if (count > 1) return { success: false, output: '', error: `找到 ${count} 处匹配。请扩大 old_string 的范围以包含更多上下文，确保匹配唯一。` };
    const newContent = content.replace(args.old_string as string, args.new_string as string);
    backupFile(args.path as string);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true, output: `已编辑文件: ${args.path}` };
  } catch (error) {
    return { success: false, output: '', error: `编辑文件失败: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// ==================== search_files ====================
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', 'target', '.mimo', '.jest-cache', '.cache', '.turbo', 'coverage', '.venv', 'venv']);

function walkFiles(dir: string, filePattern?: string, maxFiles = 500): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) results.push(...walkFiles(fullPath, filePattern, maxFiles - results.length));
      } else if (entry.isFile()) {
        if (filePattern && !entry.name.endsWith(filePattern)) continue;
        results.push(fullPath);
      }
    }
  } catch { /* skip */ }
  return results;
}

export const searchFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_files',
    description: '在项目中搜索文件内容（支持正则表达式）。搜索时会自动忽略 node_modules、.git、dist 等目录。',
    parameters: {
      type: 'object', description: '搜索参数',
      properties: {
        pattern: { type: 'string', description: '搜索的正则表达式模式' },
        path: { type: 'string', description: '搜索目录，默认当前目录' },
        file_pattern: { type: 'string', description: '文件名后缀过滤，如 ".ts"、".py"' }
      },
      required: ['pattern']
    }
  }
};

export const searchFilesHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const searchDir = path.resolve((args.path as string) || '.');
    let regex: RegExp;
    try {
      regex = new RegExp(args.pattern as string, 'gm');
    } catch {
      return { success: false, output: '', error: `无效的正则表达式: ${args.pattern}` };
    }
    const files = walkFiles(searchDir, args.file_pattern as string | undefined);
    const matches: string[] = [];
    for (const filePath of files) {
      if (matches.length >= 50) break;
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const relPath = path.relative(searchDir, filePath);
            matches.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 150)}`);
            if (matches.length >= 50) break;
          }
          regex.lastIndex = 0;
        }
      } catch { /* skip binary */ }
    }
    return { success: true, output: matches.length > 0 ? matches.join('\n') : '未找到匹配结果' };
  } catch (error) {
    return { success: false, output: '', error: `搜索失败: ${error instanceof Error ? error.message : String(error)}` };
  }
};

// ==================== list_files ====================
export const listFilesTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'list_files',
    description: '列出目录中的文件和子目录。会自动忽略 node_modules、.git、dist 等目录。',
    parameters: {
      type: 'object', description: '目录路径参数',
      properties: {
        path: { type: 'string', description: '目录路径，默认为当前目录' },
        recursive: { type: 'boolean', description: '是否递归列出子目录' }
      }
    }
  }
};

export const listFilesHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const dir = path.resolve((args.path as string) || '.');
    if (args.recursive) {
      const files = walkFiles(dir);
      const output = files.slice(0, 200).map(f => path.relative(dir, f)).join('\n');
      return { success: true, output: output + (files.length > 200 ? `\n... (共 ${files.length} 个文件，仅显示前 200 个)` : '') };
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const output = entries
      .filter(e => !IGNORE_DIRS.has(e.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map(e => `${e.name}${e.isDirectory() ? '/' : ''}`)
      .join('\n');
    return { success: true, output };
  } catch (error) {
    return { success: false, output: '', error: `无法列出文件: ${error instanceof Error ? error.message : String(error)}` };
  }
};


// ==================== apply_patch ====================
export const applyPatchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'apply_patch',
    description: '应用 unified diff 格式的补丁到文件。支持批量修改多个位置。比 edit_file 更适合多处修改。',
    parameters: {
      type: 'object', description: '补丁参数',
      properties: {
        path: { type: 'string', description: '文件路径' },
        patch: { type: 'string', description: 'Unified diff 格式的补丁内容' }
      },
      required: ['path', 'patch']
    }
  }
};

export const applyPatchHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const filePath = path.resolve(args.path as string);
    if (!fs.existsSync(filePath)) return { success: false, output: '', error: `文件不存在: ${args.path}` };

    const original = fs.readFileSync(filePath, 'utf-8');
    const { applyPatch: diffApplyPatch } = await import('diff');
    const result = diffApplyPatch(original, args.patch as string);

    if (result === false) {
      return { success: false, output: '', error: '补丁应用失败，可能是因为文件内容与补丁不匹配。请先 read_file 确认当前内容。' };
    }

    fs.writeFileSync(filePath, result, 'utf-8');
    return { success: true, output: `补丁已应用到: ${args.path}` };
  } catch (error) {
    return { success: false, output: '', error: `补丁应用失败: ${error instanceof Error ? error.message : String(error)}` };
  }
};

export function registerFileTools(registry: ToolRegistry): void {
  registry.register(readFileTool, readFileHandler, { readOnly: true, cost: 'low', maxOutputLength: 10000 });
  registry.register(writeFileTool, writeFileHandler, { readOnly: false, cost: 'medium', maxOutputLength: 2000 });
  registry.register(editFileTool, editFileHandler, { readOnly: false, cost: 'medium', maxOutputLength: 2000 });
  registry.register(searchFilesTool, searchFilesHandler, { readOnly: true, cost: 'low', maxOutputLength: 8000 });
  registry.register(listFilesTool, listFilesHandler, { readOnly: true, cost: 'low', maxOutputLength: 6000 });
  registry.register(applyPatchTool, applyPatchHandler, { readOnly: false, cost: 'medium', maxOutputLength: 2000 });
}
