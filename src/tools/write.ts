// Write 工具 - 写入文件

import fs from 'fs/promises'
import path from 'path'
import type { ToolDefinition } from './types.js'

export const writeTool: ToolDefinition = {
  name: 'Write',
  description:
    'Create a new file or completely overwrite an existing file with the provided content. ' +
    'Use this for creating new files or when you need to replace the entire contents of a file. ' +
    'For partial edits, use the Edit tool instead.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['file_path', 'content'],
  },
  requiresApproval: true,
  async execute(input) {
    try {
      const filePath = path.resolve(input.file_path)
      // 确保目录存在
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, input.content, 'utf-8')
      return {
        success: true,
        output: `File written successfully: ${filePath}`,
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Failed to write file: ${error.message}`,
      }
    }
  },
}
