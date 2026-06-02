import fs from 'fs';
import path from 'path';
import { checkPathSafety } from '../utils/safety';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';

export interface ViewArgs {
  path: string;
  view_range?: [number, number];
}

const viewDef: ToolDefinition = {
  name: 'view',
  description: 'Read a file with optional line range. Use this to understand code before editing.',
  permission: 'read',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      view_range: {
        type: 'array',
        description: 'Line range [start, end] (1-indexed, optional)',
      },
    },
    required: ['path'],
  },
};

export function handleView(args: Record<string, unknown>): ToolResult {
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
      return { success: false, output: '', error: `路径是目录，不是文件: ${resolved}` };
    }

    if (stat.size > 1024 * 1024) {
      return { success: false, output: '', error: `文件过大（${(stat.size / 1024 / 1024).toFixed(1)}MB），限制 1MB` };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    const lines = content.split('\n');

    const viewRange = args.view_range as [number, number] | undefined;
    if (viewRange && Array.isArray(viewRange) && viewRange.length === 2) {
      const start = Math.max(1, Math.min(viewRange[0], viewRange[1]));
      const end = Math.min(lines.length, Math.max(viewRange[0], viewRange[1]));
      const sliced = lines.slice(start - 1, end);
      return { success: true, output: sliced.join('\n') };
    }

    return { success: true, output: content };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `读取失败: ${msg}` };
  }
}

export function registerViewTool(): void {
  toolRegistry.register(viewDef, handleView);
}
