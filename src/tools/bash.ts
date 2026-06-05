// Bash 工具 - 执行 shell 命令

import { exec } from 'child_process'
import type { ToolDefinition } from './types.js'
import { PermissionManager } from '../permissions/manager.js'

const DEFAULT_TIMEOUT = 120000 // 2 minutes
const MAX_TIMEOUT = 600000 // 10 minutes

const permissionManager = new PermissionManager()

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
      abort_signal: {
        type: 'boolean',
        description:
          'Optional signal to abort the command execution',
      },
    },
    required: ['command'],
  },
  requiresApproval: true,
  async execute(input) {
    // Check permission before executing
    const permLevel = permissionManager.check('Bash', { command: input.command })
    if (permLevel === 'deny') {
      return { success: false, output: '', error: 'Command blocked by permission rules' }
    }

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

      // Handle abort_signal
      if (input.abort_signal && child) {
        child.kill('SIGTERM')
      }

      // 确保进程在超时时被杀死
      if (child) {
        setTimeout(() => {
          child.kill('SIGTERM')
        }, timeout + 1000)
      }
    })
  },
}
