// Grep 工具 - 内容搜索

import { exec } from 'child_process'
import type { ToolDefinition } from './types.js'

export const grepTool: ToolDefinition = {
  name: 'Grep',
  description:
    'Search file contents using a regex pattern. Uses ripgrep (rg) if available, falls back to grep. ' +
    'Use this to find specific code patterns, function names, or text across the project. ' +
    'Supports filtering by file type with the glob parameter.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in. Defaults to current directory.',
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,ts}")',
      },
      context: {
        type: 'number',
        description: 'Number of context lines to show before and after each match',
      },
    },
    required: ['pattern'],
  },
  requiresApproval: false,
  async execute(input) {
    try {
      const searchPath = input.path || '.'
      const contextFlag = input.context ? `-C ${input.context}` : ''
      const globFlag = input.glob ? `--glob "${input.glob}"` : ''

      // 尝试使用 ripgrep，如果不可用则回退到 grep
      const command = `rg --no-heading -n ${contextFlag} ${globFlag} "${input.pattern}" ${searchPath} 2>/dev/null || grep -rn ${contextFlag} ${globFlag} "${input.pattern}" ${searchPath} 2>/dev/null`

      return new Promise((resolve) => {
        exec(
          command,
          { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 10 },
          (error, stdout, stderr) => {
            if (error && !stdout) {
              resolve({
                success: true,
                output: 'No matches found.',
              })
            } else {
              resolve({
                success: true,
                output: stdout || 'No matches found.',
              })
            }
          }
        )
      })
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Grep search failed: ${error.message}`,
      }
    }
  },
}
