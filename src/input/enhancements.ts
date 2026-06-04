// 快捷键增强 - @文件引用、#记忆、!直接执行

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface InputProcessorResult {
  /** 处理后的文本 */
  processedText: string
  /** 是否有特殊处理 */
  handled: boolean
  /** 附加信息 */
  metadata?: Record<string, any>
}

/**
 * 处理 @ 文件引用
 * @param text 输入文本
 * @param workingDir 工作目录
 */
export async function processFileReferences(
  text: string,
  workingDir: string = process.cwd()
): Promise<InputProcessorResult> {
  // 匹配 @path/to/file 模式
  const filePattern = /@([\w\-\.\/\\]+)/g
  const matches = [...text.matchAll(filePattern)]

  if (matches.length === 0) {
    return { processedText: text, handled: false }
  }

  let processedText = text
  const files: Array<{ path: string; content: string }> = []

  for (const match of matches) {
    const filePath = match[1]
    const fullPath = path.resolve(workingDir, filePath)

    try {
      const stat = await fs.stat(fullPath)

      if (stat.isFile()) {
        const content = await fs.readFile(fullPath, 'utf-8')
        files.push({ path: filePath, content })

        // 替换 @file 为文件内容摘要
        const preview = content.slice(0, 200).replace(/\n/g, ' ')
        processedText = processedText.replace(
          match[0],
          `[File: ${filePath}]\n${preview}${content.length > 200 ? '...' : ''}`
        )
      } else if (stat.isDirectory()) {
        // 列出目录内容
        const entries = await fs.readdir(fullPath, { withFileTypes: true })
        const listing = entries
          .slice(0, 20)
          .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
          .join('\n')

        processedText = processedText.replace(
          match[0],
          `[Directory: ${filePath}]\n${listing}${entries.length > 20 ? '\n...' : ''}`
        )
      }
    } catch {
      // 文件不存在，保持原样
    }
  }

  return {
    processedText,
    handled: true,
    metadata: { files },
  }
}

/**
 * 处理 # 记忆命令
 * @param text 输入文本
 */
export function processMemoryCommand(text: string): InputProcessorResult {
  if (!text.startsWith('#')) {
    return { processedText: text, handled: false }
  }

  // 移除 # 前缀
  const memoryText = text.slice(1).trim()

  if (!memoryText) {
    return {
      processedText: text,
      handled: true,
      metadata: { action: 'show' },
    }
  }

  return {
    processedText: memoryText,
    handled: true,
    metadata: { action: 'save', content: memoryText },
  }
}

/**
 * 处理 ! 直接执行命令
 * @param text 输入文本
 */
export function processDirectCommand(text: string): InputProcessorResult {
  if (!text.startsWith('!')) {
    return { processedText: text, handled: false }
  }

  // 移除 ! 前缀
  const command = text.slice(1).trim()

  if (!command) {
    return {
      processedText: text,
      handled: true,
      metadata: { action: 'toggle-shell-mode' },
    }
  }

  return {
    processedText: command,
    handled: true,
    metadata: { action: 'execute', command },
  }
}

/**
 * 执行直接命令
 * @param command 命令字符串
 * @param workingDir 工作目录
 */
export async function executeDirectCommand(
  command: string,
  workingDir: string = process.cwd()
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: 30000,
      maxBuffer: 1024 * 1024, // 1MB
    })

    return {
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
    }
  } catch (error: any) {
    return {
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code || 1,
    }
  }
}

/**
 * 获取文件路径自动补全建议
 * @param partial 部分输入
 * @param workingDir 工作目录
 */
export async function getFileCompletions(
  partial: string,
  workingDir: string = process.cwd()
): Promise<string[]> {
  // 移除 @ 前缀
  const query = partial.startsWith('@') ? partial.slice(1) : partial
  
  // 分离目录和文件名
  const dir = path.dirname(query)
  const base = path.basename(query)
  
  const fullPath = path.resolve(workingDir, dir)

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    
    const matches = entries
      .filter(e => e.name.startsWith(base))
      .map(e => {
        const relativePath = path.join(dir === '.' ? '' : dir, e.name)
        return `@${relativePath}${e.isDirectory() ? '/' : ''}`
      })
      .slice(0, 10)

    return matches
  } catch {
    return []
  }
}

/**
 * 处理所有输入增强
 * @param text 原始输入
 * @param workingDir 工作目录
 */
export async function processInputEnhancements(
  text: string,
  workingDir: string = process.cwd()
): Promise<{
  text: string
  isCommand: boolean
  isMemory: boolean
  isShell: boolean
  command?: string
  memoryContent?: string
  files?: Array<{ path: string; content: string }>
}> {
  // 检查 ! 直接命令
  const cmdResult = processDirectCommand(text)
  if (cmdResult.handled) {
    if (cmdResult.metadata?.action === 'execute') {
      return {
        text: cmdResult.processedText,
        isCommand: true,
        isMemory: false,
        isShell: false,
        command: cmdResult.metadata.command,
      }
    }
    if (cmdResult.metadata?.action === 'toggle-shell-mode') {
      return {
        text: '',
        isCommand: false,
        isMemory: false,
        isShell: true,
      }
    }
  }

  // 检查 # 记忆命令
  const memResult = processMemoryCommand(text)
  if (memResult.handled) {
    return {
      text: memResult.processedText,
      isCommand: false,
      isMemory: true,
      isShell: false,
      memoryContent: memResult.metadata?.content,
    }
  }

  // 处理 @ 文件引用
  const fileResult = await processFileReferences(text, workingDir)
  
  return {
    text: fileResult.processedText,
    isCommand: false,
    isMemory: false,
    isShell: false,
    files: fileResult.metadata?.files,
  }
}
