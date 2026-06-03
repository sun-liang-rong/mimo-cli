// Status bar - rich metrics display

import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { AgentPhase } from './types.js'
import path from 'path'

interface StatusBarProps {
  model: string
  phase: AgentPhase | 'idle'
  iteration: number
  maxIterations: number
  toolCallsTotal: number
  toolCallsActive: number
  tokenCount: number
  duration: number
  workingDir: string
  error?: string
  approvalTool?: string
}

function phaseLabel(phase: AgentPhase | 'idle'): { text: string; color: string } {
  switch (phase) {
    case 'thinking':
      return { text: 'Thinking', color: 'yellow' }
    case 'streaming-text':
      return { text: 'Streaming', color: 'green' }
    case 'executing-tools':
      return { text: 'Running', color: 'cyan' }
    case 'awaiting-approval':
      return { text: 'Awaiting', color: 'yellow' }
    case 'planning':
      return { text: 'Planning', color: 'blue' }
    case 'completed':
      return { text: 'Ready', color: 'green' }
    case 'error':
      return { text: 'Error', color: 'red' }
    default:
      return { text: 'Ready', color: 'green' }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatTokens(n: number): string {
  if (n <= 0) return ''
  return n.toLocaleString('en-US') + ' tok'
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

export function StatusBar({
  model,
  phase,
  iteration,
  maxIterations,
  toolCallsTotal,
  toolCallsActive,
  tokenCount,
  duration,
  workingDir,
}: StatusBarProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  const { text: phaseText, color: phaseColor } = phaseLabel(phase)
  const dir = shortenDir(workingDir, Math.max(20, Math.floor(width * 0.25)))

  return (
    <Box
      borderStyle="single"
      borderColor={phase === 'error' ? 'red' : 'gray'}
      width="100%"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan" bold>{model}</Text>
        <Text color="gray"> │ </Text>
        <Text color={phaseColor}>● {phaseText}</Text>
        {iteration > 0 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="gray">Iter {iteration}/{maxIterations}</Text>
          </>
        )}
        {toolCallsTotal > 0 && (
          <>
            <Text color="gray"> │ </Text>
            <Text color="gray">{toolCallsTotal} tools</Text>
            {toolCallsActive > 0 && (
              <Text color="cyan"> ({toolCallsActive} active)</Text>
            )}
          </>
        )}
      </Box>
      <Box>
        {tokenCount > 0 && (
          <>
            <Text color="gray" dimColor>{formatTokens(tokenCount)}</Text>
            <Text color="gray"> │ </Text>
          </>
        )}
        {duration > 0 && (
          <>
            <Text color="gray" dimColor>{formatDuration(duration)}</Text>
            <Text color="gray"> │ </Text>
          </>
        )}
        <Text color="gray" dimColor>{dir}</Text>
      </Box>
    </Box>
  )
}
