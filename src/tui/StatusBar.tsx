// 顶部状态栏 - Claude Code 风格: 单行极简, model · cwd · branch · cost

import React from 'react'
import { Box, Text, useStdout } from 'ink'
import path from 'path'

export interface TopStatusBarProps {
  model: string
  workingDir: string
  branch?: string
  costSummary?: string
  contextUsage?: number  // 0-100
}

function shortenDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const home = process.env.HOME || process.env.USERPROFILE || ''
  let display = dir
  if (home && dir.startsWith(home)) {
    display = '~' + dir.slice(home.length)
  }
  if (display.length <= maxLen) return display
  const base = path.basename(display)
  const prefix = '…'
  const room = maxLen - prefix.length - base.length - 1
  if (room <= 0) return base.slice(0, maxLen)
  return prefix + display.slice(-room) + path.sep + base
}

function getContextColor(usage: number): string {
  if (usage < 50) return 'green'
  if (usage < 70) return 'yellow'
  if (usage < 85) return 'red'
  return 'red'
}

function getContextBar(usage: number, width: number = 10): string {
  const filled = Math.round((usage / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

export function TopStatusBar({ model, workingDir, branch, costSummary, contextUsage }: TopStatusBarProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  
  // 计算各部分的最大宽度
  const modelWidth = model.length + 4
  const branchWidth = branch ? branch.length + 4 : 0
  const costWidth = costSummary ? costSummary.length + 4 : 0
  const contextWidth = contextUsage != null ? 18 : 0  // "ctx ████░░░░░░ 45%"
  const dirMaxWidth = Math.max(20, width - modelWidth - branchWidth - costWidth - contextWidth - 10)
  
  const dir = shortenDir(workingDir, dirMaxWidth)

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderTop={false}
      width="100%"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan" bold>{model}</Text>
        <Text color="gray">  ·  </Text>
        <Text color="gray">{dir}</Text>
        {branch && (
          <>
            <Text color="gray">  ·  </Text>
            <Text color="gray">⎇ </Text>
            <Text color="green">{branch}</Text>
          </>
        )}
      </Box>
      <Box>
        {contextUsage != null && (
          <>
            <Text color="gray">ctx </Text>
            <Text color={getContextColor(contextUsage)}>{getContextBar(contextUsage)}</Text>
            <Text color="gray"> {contextUsage}%</Text>
            {costSummary && <Text color="gray"> · </Text>}
          </>
        )}
        {costSummary && (
          <Text color="yellow">{costSummary}</Text>
        )}
      </Box>
    </Box>
  )
}

// Alias for legacy imports (StatusBar was renamed to TopStatusBar)
export { TopStatusBar as StatusBar }
