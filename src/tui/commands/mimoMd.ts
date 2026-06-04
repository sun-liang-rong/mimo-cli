// MIMO.md 相关的斜杠命令处理

import fs from 'fs/promises'
import path from 'path'
import {
  loadProjectContext,
  generateMimoMdTemplate,
  getProjectContextSummary,
} from '../context/project.js'

export interface MimoMdCommandResult {
  handled: boolean
  message?: string
}

/**
 * 处理 /init 命令 - 创建 MIMO.md 模板
 */
export async function handleInitCommand(): Promise<MimoMdCommandResult> {
  const mimoPath = path.join(process.cwd(), 'MIMO.md')
  
  // 检查是否已存在
  try {
    await fs.access(mimoPath)
    return {
      handled: true,
      message: 'MIMO.md already exists. Edit it manually or delete it first.',
    }
  } catch {
    // 文件不存在，继续创建
  }

  // 生成模板
  const template = generateMimoMdTemplate()
  
  // 确保 .mimo 目录存在
  const mimoDir = path.join(process.cwd(), '.mimo')
  await fs.mkdir(mimoDir, { recursive: true })
  
  // 写入文件
  await fs.writeFile(mimoPath, template, 'utf-8')
  
  return {
    handled: true,
    message: `Created MIMO.md in ${process.cwd()}\nEdit it to add your project context.`,
  }
}

/**
 * 处理 /memory 命令 - 显示或编辑项目上下文
 */
export async function handleMemoryCommand(): Promise<MimoMdCommandResult> {
  const context = await loadProjectContext()
  const summary = getProjectContextSummary(context)
  
  if (!context.found) {
    return {
      handled: true,
      message: `${summary}\n\nRun /init to create a MIMO.md file.`,
    }
  }

  // 显示上下文摘要
  const lines: string[] = [
    '📋 Project Context Status',
    '─'.repeat(40),
    summary,
    '',
  ]

  if (context.projectMd.trim()) {
    const preview = context.projectMd
      .split('\n')
      .slice(0, 10)
      .join('\n')
    lines.push('📄 MIMO.md Preview:')
    lines.push(preview)
    if (context.projectMd.split('\n').length > 10) {
      lines.push('... (truncated)')
    }
  }

  lines.push('')
  lines.push('Files loaded:')
  lines.push(`  • MIMO.md: ${context.projectMd.trim() ? '✅' : '❌'}`)
  lines.push(`  • .mimo/MIMO.local.md: ${context.localMd.trim() ? '✅' : '❌'}`)

  return {
    handled: true,
    message: lines.join('\n'),
  }
}

/**
 * 处理 /context 命令 - 显示上下文使用情况
 */
export async function handleContextCommand(
  currentTokens: number,
  maxTokens: number
): Promise<MimoMdCommandResult> {
  const usagePercent = Math.round((currentTokens / maxTokens) * 100)
  const remaining = maxTokens - currentTokens
  
  // 颜色指示
  let status: string
  let emoji: string
  if (usagePercent < 50) {
    status = 'Healthy'
    emoji = '🟢'
  } else if (usagePercent < 70) {
    status = 'Moderate'
    emoji = '🟡'
  } else if (usagePercent < 85) {
    status = 'High'
    emoji = '🟠'
  } else {
    status = 'Critical'
    emoji = '🔴'
  }

  // 生成进度条
  const barLength = 30
  const filledLength = Math.round((usagePercent / 100) * barLength)
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)

  const lines = [
    `${emoji} Context Window Usage`,
    '─'.repeat(40),
    `Status: ${status}`,
    `Usage:  ${bar} ${usagePercent}%`,
    '',
    `Used:      ${currentTokens.toLocaleString()} tokens`,
    `Remaining: ${remaining.toLocaleString()} tokens`,
    `Total:     ${maxTokens.toLocaleString()} tokens`,
    '',
  ]

  // 添加建议
  if (usagePercent >= 85) {
    lines.push('⚠️  Recommendation: Run /compact to compress context')
  } else if (usagePercent >= 70) {
    lines.push('💡 Tip: Consider /compact if responses slow down')
  }

  return {
    handled: true,
    message: lines.join('\n'),
  }
}
