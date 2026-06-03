// Diff 可视化 - unified diff 格式 + 颜色

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
  oldLineNum?: number
  newLineNum?: number
}

export interface DiffResult {
  lines: DiffLine[]
  added: number
  removed: number
  filename?: string
}

/**
 * 生成 unified diff
 */
export function createUnifiedDiff(
  oldContent: string,
  newContent: string,
  filename?: string,
  contextLines: number = 3
): DiffResult {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  // 使用 Myers 算法的简化版计算 LCS
  const editScript = computeEditScript(oldLines, newLines)
  const result: DiffLine[] = []
  let added = 0
  let removed = 0

  if (filename) {
    result.push({ type: 'header', content: `--- ${filename}` })
    result.push({ type: 'header', content: `+++ ${filename}` })
  }

  let oldIdx = 0
  let newIdx = 0

  for (const op of editScript) {
    if (op.type === 'equal') {
      // 上下文行
      for (let i = 0; i < op.count; i++) {
        result.push({
          type: 'context',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
          newLineNum: newIdx + 1,
        })
        oldIdx++
        newIdx++
      }
    } else if (op.type === 'remove') {
      for (let i = 0; i < op.count; i++) {
        result.push({
          type: 'remove',
          content: oldLines[oldIdx],
          oldLineNum: oldIdx + 1,
        })
        oldIdx++
        removed++
      }
    } else if (op.type === 'add') {
      for (let i = 0; i < op.count; i++) {
        result.push({
          type: 'add',
          content: newLines[newIdx],
          newLineNum: newIdx + 1,
        })
        newIdx++
        added++
      }
    }
  }

  return { lines: result, added, removed, filename }
}

type EditOp =
  | { type: 'equal'; count: number }
  | { type: 'add'; count: number }
  | { type: 'remove'; count: number }

/**
 * 简化的编辑脚本计算 (基于 LCS)
 */
function computeEditScript(oldLines: string[], newLines: string[]): EditOp[] {
  const m = oldLines.length
  const n = newLines.length

  // 对于非常大的文件，使用简单的逐行比较
  if (m > 1000 || n > 1000) {
    return simpleDiff(oldLines, newLines)
  }

  // LCS DP 表
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // 回溯生成编辑脚本
  const ops: EditOp[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // 相等
      if (ops.length > 0 && ops[0].type === 'equal') {
        ops[0].count++
      } else {
        ops.unshift({ type: 'equal', count: 1 })
      }
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // 添加
      if (ops.length > 0 && ops[0].type === 'add') {
        ops[0].count++
      } else {
        ops.unshift({ type: 'add', count: 1 })
      }
      j--
    } else {
      // 删除
      if (ops.length > 0 && ops[0].type === 'remove') {
        ops[0].count++
      } else {
        ops.unshift({ type: 'remove', count: 1 })
      }
      i--
    }
  }

  return ops
}

/**
 * 大文件简单 diff (逐行比较)
 */
function simpleDiff(oldLines: string[], newLines: string[]): EditOp[] {
  const ops: EditOp[] = []
  const maxLen = Math.max(oldLines.length, newLines.length)

  let oi = 0
  let ni = 0

  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      if (ops.length > 0 && ops[ops.length - 1].type === 'equal') {
        ops[ops.length - 1].count++
      } else {
        ops.push({ type: 'equal', count: 1 })
      }
      oi++
      ni++
    } else if (ni < newLines.length && (oi >= oldLines.length || !oldLines.includes(newLines[ni], oi))) {
      if (ops.length > 0 && ops[ops.length - 1].type === 'add') {
        ops[ops.length - 1].count++
      } else {
        ops.push({ type: 'add', count: 1 })
      }
      ni++
    } else if (oi < oldLines.length) {
      if (ops.length > 0 && ops[ops.length - 1].type === 'remove') {
        ops[ops.length - 1].count++
      } else {
        ops.push({ type: 'remove', count: 1 })
      }
      oi++
    } else {
      break
    }
  }

  return ops
}

/**
 * 格式化 diff 结果为带颜色的字符串 (ANSI 终端)
 */
export function formatDiff(result: DiffResult): string {
  const lines: string[] = []

  for (const line of result.lines) {
    switch (line.type) {
      case 'header':
        lines.push(`\x1b[1;35m${line.content}\x1b[0m`)
        break
      case 'context':
        lines.push(`\x1b[2m${line.oldLineNum?.toString().padStart(4)} ${line.newLineNum?.toString().padStart(4)}  ${line.content}\x1b[0m`)
        break
      case 'add':
        lines.push(`\x1b[32m     ${line.newLineNum?.toString().padStart(4)} +${line.content}\x1b[0m`)
        break
      case 'remove':
        lines.push(`\x1b[31m${line.oldLineNum?.toString().padStart(4)}      -${line.content}\x1b[0m`)
        break
    }
  }

  return lines.join('\n')
}

/**
 * 格式化 diff 为纯文本 (用于工具结果)
 */
export function formatDiffPlainText(result: DiffResult): string {
  const lines: string[] = []
  lines.push(`@@ -0,${result.removed} +0,${result.added} @@`)

  for (const line of result.lines) {
    switch (line.type) {
      case 'header':
        lines.push(line.content)
        break
      case 'context':
        lines.push(`  ${line.content}`)
        break
      case 'add':
        lines.push(`+ ${line.content}`)
        break
      case 'remove':
        lines.push(`- ${line.content}`)
        break
    }
  }

  return lines.join('\n')
}
