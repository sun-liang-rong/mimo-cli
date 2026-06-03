// Read 工具 - 读取文件内容

import fs from 'fs/promises'
import path from 'path'
import type { ToolDefinition } from './types.js'

export const readTool: ToolDefinition = {
  name: 'Read',
  description:
    'Read the contents of a file. Returns the file content with line numbers. ' +
    'Supports reading specific line ranges with offset and limit parameters. ' +
    'Use this tool to examine existing files before making changes.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to read',
      },
      offset: {
        type: 'number',
        description:
          'The line number to start reading from (0-based). Only provide if the file is too large to read at once.',
      },
      limit: {
        type: 'number',
        description:
          'The maximum number of lines to read. Only provide if the file is too large to read at once.',
      },
    },
    required: ['file_path'],
  },
  requiresApproval: false,
  async execute(input) {
    try {
      const filePath = path.resolve(input.file_path)
      const content = await fs.readFile(filePath, 'utf-8')
      const lines = content.split('\n')

      const offset = input.offset || 0
      const limit = input.limit || lines.length
      const selectedLines = lines.slice(offset, offset + limit)

      // 带行号输出
      const numbered = selectedLines
        .map((line, i) => `${offset + i + 1}\t${line}`)
        .join('\n')

      return {
        success: true,
        output: numbered || '(empty file)',
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Failed to read file: ${error.message}`,
      }
    }
  },
}
