// Bash 工具 - 执行 shell 命令

import { exec } from 'child_process'
import type { ToolDefinition } from './types.js'

const DEFAULT_TIMEOUT = 120000 // 2 minutes
const MAX_TIMEOUT = 600000 // 10 minutes

export const bashTool: ToolDefinition = {
  name: 'Bash',
  description:
    'Execute a shell command in the user\'s system. ' +
    'Use this for running build commands, tests, git operations, or any system commands. ' +
    'Always prefer dedicated tools (Read, Write, Edit, Grep, Glob) when they can accomplish the task. ' +
    'Avoid using Bash for reading files, searching content, or file pattern matching.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      timeout: {
        type: 'number',
        description:
          'Optional timeout in milliseconds (default 120000, max 600000)',
      },
    },
    required: ['command'],
  },
  requiresApproval: true,
  async execute(input) {
    const timeout = Math.min(
      input.timeout || DEFAULT_TIMEOUT,
      MAX_TIMEOUT
    )

    return new Promise((resolve) => {
      const child = exec(
        input.command,
        {
          timeout,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024 * 10, // 10MB
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              output: stdout || '',
              error: `${error.message}${stderr ? '\n' + stderr : ''}`,
            })
          } else {
            resolve({
              success: true,
              output: stdout || '(no output)',
            })
          }
        }
      )

      // 确保进程在超时时被杀死
      if (child) {
        setTimeout(() => {
          child.kill('SIGTERM')
        }, timeout + 1000)
      }
    })
  },
}
