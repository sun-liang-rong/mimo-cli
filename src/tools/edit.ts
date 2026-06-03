// Edit 工具 - 精确编辑文件（old_string -> new_string）

import fs from 'fs/promises'
import path from 'path'
import type { ToolDefinition } from './types.js'
import { createUnifiedDiff, formatDiffPlainText } from './diff.js'

export const editTool: ToolDefinition = {
  name: 'Edit',
  description:
    'Make a targeted edit to an existing file by replacing an exact string match with new content. ' +
    'The old_string must match exactly (including whitespace and indentation). ' +
    'Use this for surgical edits to avoid rewriting entire files.',
  input_schema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'The absolute or relative path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to find and replace (must match exactly)',
      },
      new_string: {
        type: 'string',
        description: 'The string to replace old_string with',
      },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  requiresApproval: true,
  async execute(input) {
    try {
      const filePath = path.resolve(input.file_path)
      const content = await fs.readFile(filePath, 'utf-8')

      if (!content.includes(input.old_string)) {
        return {
          success: false,
          output: '',
          error: 'old_string not found in the file. Make sure it matches exactly.',
        }
      }

      // 检查是否有多处匹配
      const count = content.split(input.old_string).length - 1
      if (count > 1) {
        return {
          success: false,
          output: '',
          error: `Found ${count} matches of old_string. Please provide a more unique string to match.`,
        }
      }

      const newContent = content.replace(input.old_string, input.new_string)
      await fs.writeFile(filePath, newContent, 'utf-8')

      // 生成 diff 预览
      const diff = createUnifiedDiff(input.old_string, input.new_string, path.basename(filePath))
      const diffText = formatDiffPlainText(diff)

      return {
        success: true,
        output: `File edited successfully: ${filePath}\n\n${diffText}`,
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Failed to edit file: ${error.message}`,
      }
    }
  },
}
