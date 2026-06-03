// Git 工具 - 专用 Git 操作 (status/diff/commit/branch/log)

import { exec } from 'child_process'
import type { ToolDefinition } from './types.js'

function runGit(args: string, cwd?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(
      `git ${args}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, cwd: cwd || process.cwd() },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          code: error ? (error as any).code || 1 : 0,
        })
      }
    )
  })
}

export const gitTool: ToolDefinition = {
  name: 'Git',
  description:
    'Perform git operations: status, diff, commit, branch, log, show, add, restore. ' +
    'Use this instead of Bash for git commands. Supports subcommands: ' +
    'status (working tree status), diff (unstaged/staged changes), ' +
    'branch (list/create/switch branches), log (commit history), ' +
    'commit (create commit with message), add (stage files), ' +
    'restore (discard changes), show (show commit details).',
  input_schema: {
    type: 'object',
    properties: {
      subcommand: {
        type: 'string',
        enum: ['status', 'diff', 'branch', 'log', 'commit', 'add', 'restore', 'show'],
        description: 'The git subcommand to execute',
      },
      args: {
        type: 'string',
        description: 'Additional arguments for the subcommand (e.g., file paths, branch names, commit messages)',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the git command',
      },
    },
    required: ['subcommand'],
  },
  requiresApproval: false,
  async execute(input) {
    const subcommand = input.subcommand
    const extraArgs = input.args || ''
    const cwd = input.cwd

    try {
      switch (subcommand) {
        case 'status': {
          const result = await runGit('status --short --branch', cwd)
          return {
            success: true,
            output: result.stdout || 'Working tree clean',
          }
        }

        case 'diff': {
          const result = await runGit(`diff ${extraArgs}`, cwd)
          if (!result.stdout.trim()) {
            const staged = await runGit('diff --cached', cwd)
            return {
              success: true,
              output: staged.stdout || 'No changes',
            }
          }
          return {
            success: true,
            output: result.stdout,
          }
        }

        case 'branch': {
          if (extraArgs.startsWith('-c ') || extraArgs.startsWith('-b ')) {
            // 创建分支
            const result = await runGit(`branch ${extraArgs}`, cwd)
            return {
              success: result.code === 0,
              output: result.stdout || result.stderr,
              error: result.code !== 0 ? result.stderr : undefined,
            }
          }
          if (extraArgs.startsWith('checkout ') || extraArgs.startsWith('switch ')) {
            const result = await runGit(extraArgs.startsWith('checkout') ? extraArgs : `switch ${extraArgs.slice(7)}`, cwd)
            return {
              success: result.code === 0,
              output: result.stdout || result.stderr,
              error: result.code !== 0 ? result.stderr : undefined,
            }
          }
          const result = await runGit('branch -a', cwd)
          return {
            success: true,
            output: result.stdout || 'No branches',
          }
        }

        case 'log': {
          const format = extraArgs || '--oneline -20'
          const result = await runGit(`log ${format}`, cwd)
          return {
            success: true,
            output: result.stdout || 'No commits',
          }
        }

        case 'commit': {
          if (!extraArgs) {
            return {
              success: false,
              output: '',
              error: 'Commit message is required. Use args: "-m \\"message\\""',
            }
          }
          const result = await runGit(`commit ${extraArgs}`, cwd)
          return {
            success: result.code === 0,
            output: result.stdout || result.stderr,
            error: result.code !== 0 ? result.stderr : undefined,
          }
        }

        case 'add': {
          if (!extraArgs) {
            return {
              success: false,
              output: '',
              error: 'File paths are required. Use args: "." or specific paths',
            }
          }
          const result = await runGit(`add ${extraArgs}`, cwd)
          return {
            success: result.code === 0,
            output: result.stdout || `Staged: ${extraArgs}`,
            error: result.code !== 0 ? result.stderr : undefined,
          }
        }

        case 'restore': {
          if (!extraArgs) {
            return {
              success: false,
              output: '',
              error: 'File paths are required. Use args: "." or specific paths',
            }
          }
          const result = await runGit(`restore ${extraArgs}`, cwd)
          return {
            success: result.code === 0,
            output: result.stdout || `Restored: ${extraArgs}`,
            error: result.code !== 0 ? result.stderr : undefined,
          }
        }

        case 'show': {
          const target = extraArgs || 'HEAD'
          const result = await runGit(`show ${target}`, cwd)
          return {
            success: result.code === 0,
            output: result.stdout || result.stderr,
            error: result.code !== 0 ? result.stderr : undefined,
          }
        }

        default:
          return {
            success: false,
            output: '',
            error: `Unknown git subcommand: ${subcommand}. Supported: status, diff, branch, log, commit, add, restore, show`,
          }
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Git command failed: ${error.message}`,
      }
    }
  },
}
