// Grep 工具 - 内容搜索

import { spawn } from 'child_process'
import type { ToolDefinition } from './types.js'

const MAX_BYTES = 1024 * 100 // 100KB
const MAX_LINES = 500

function runSearch(args: string[], lineCount: number): Promise<{ output: string; truncated: boolean; linesShown: number }> {
  return new Promise((resolve) => {
    const child = spawn(args[0], args.slice(1), { stdio: ['ignore', 'pipe', 'ignore'] })

    let output = ''
    let truncated = false
    let bytes = 0
    let lines = lineCount

    child.stdout.on('data', (chunk: Buffer) => {
      if (truncated) return
      bytes += chunk.length
      lines += (chunk.toString().match(/\n/g) || []).length

      if (bytes >= MAX_BYTES || lines >= MAX_LINES) {
        truncated = true
        // trim to limit
        output += chunk.toString().slice(0, MAX_BYTES - (bytes - chunk.length))
        // kill rg — need to kill the whole process group
        try { child.kill('SIGTERM') } catch {}
      } else {
        output += chunk.toString()
      }
    })

    child.on('close', () => {
      resolve({ output: output.trimEnd(), truncated, linesShown: lines })
    })

    child.on('error', () => {
      resolve({ output: '', truncated: false, linesShown: 0 })
    })
  })
}

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
      const contextArgs = input.context ? ['-C', String(input.context)] : []
      const globArgs = input.glob ? ['--glob', input.glob] : []

      // Build rg args
      const rgArgs = ['--no-heading', '-n', ...contextArgs, ...globArgs, input.pattern, searchPath]

      // Try ripgrep first, fall back to grep
      const result = await runSearch(['rg', ...rgArgs], 0)

      if (!result.output) {
        // rg produced no output or failed — fall back to grep
        const grepGlobArgs = input.glob ? ['--include', input.glob] : []
        const grepArgs = ['-rn', ...contextArgs, ...grepGlobArgs, input.pattern, searchPath]
        const grepResult = await runSearch(['grep', ...grepArgs], 0)

        if (!grepResult.output) {
          return { success: true, output: 'No matches found.' }
        }

        let output = grepResult.output
        if (grepResult.truncated) {
          const matchCount = (grepResult.output.match(/\n/g) || []).length
          output += `\n[truncated - showing first ${matchCount} results]`
        }
        return { success: true, output }
      }

      let output = result.output
      if (result.truncated) {
        const matchCount = (result.output.match(/\n/g) || []).length
        output += `\n[truncated - showing first ${matchCount} results]`
      }
      return { success: true, output }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Grep search failed: ${error.message}`,
      }
    }
  },
}
