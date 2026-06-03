// Glob 工具 - 文件模式匹配

import fg from 'fast-glob'
import path from 'path'
import type { ToolDefinition } from './types.js'

export const globTool: ToolDefinition = {
  name: 'Glob',
  description:
    'Find files matching a glob pattern. Returns matching file paths sorted by modification time. ' +
    'Use this to discover files before reading them, or to understand project structure. ' +
    'Common patterns: "**/*.ts", "src/**/*.tsx", "**/package.json"',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The glob pattern to match files against (e.g., "**/*.ts")',
      },
      path: {
        type: 'string',
        description:
          'The directory to search in. Defaults to the current working directory.',
      },
    },
    required: ['pattern'],
  },
  requiresApproval: false,
  async execute(input) {
    try {
      const searchPath = input.path
        ? path.resolve(input.path)
        : process.cwd()

      const entries = await fg(input.pattern, {
        cwd: searchPath,
        onlyFiles: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
        dot: true,
      })

      if (entries.length === 0) {
        return {
          success: true,
          output: 'No files found matching the pattern.',
        }
      }

      return {
        success: true,
        output: entries.join('\n'),
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Glob search failed: ${error.message}`,
      }
    }
  },
}
