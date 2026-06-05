import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Box, Text, useStdout, useInput } from 'ink'
import type { Timeline, TimelineItem, AgentTaskItem, TaskStep } from './types.js'

interface TimelineViewProps {
  timeline: Timeline
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

// === Phase 1: Cheap line counting (no JSX) ===

interface ItemMeta {
  item: TimelineItem
  startLine: number  // global line index where this item starts
  lineCount: number  // total lines this item occupies
}

function countItemLines(item: TimelineItem, columns: number): number {
  if (item.type === 'user-message') {
    // margin-top + wrapped content lines + margin-bottom
    const contentCols = Math.max(1, columns - 4) // account for "› " prefix + paddingX
    const wrappedLines = Math.max(1, Math.ceil(item.content.length / contentCols))
    return 1 + wrappedLines + 1
  }

  if (item.type === 'agent-task') {
    let lines = 0
    lines += 1 // margin-top
    lines += 1 // status header

    if (item.status === 'error' && item.error) {
      lines += item.error.split('\n').length
    }

    // Tool steps (last MAX_VISIBLE_STEPS)
    const MAX_VISIBLE_STEPS = 8
    const allToolSteps = item.steps.filter(s => s.type === 'tool-call')
    const visibleSteps = allToolSteps.slice(-MAX_VISIBLE_STEPS)
    const hiddenCount = allToolSteps.length - visibleSteps.length

    if (hiddenCount > 0) lines += 1 // "+N earlier" line

    const contentCols = Math.max(1, columns - 8)
    for (const step of visibleSteps) {
      lines += 1 // tool header
      if (step.status !== 'running' && step.status !== 'pending' && step.toolCall?.result) {
        const resultText = truncateText(step.toolCall.result, 200)
        lines += Math.max(1, Math.ceil((resultText.length + 2) / contentCols))
      }
    }

    // Streaming text
    if (item.streamingText && item.status === 'running') {
      const MAX_STREAMING_LINES = 6
      const streamLines = item.streamingText.split('\n')
      lines += Math.min(MAX_STREAMING_LINES, streamLines.length)
      lines += 1 // cursor
    }

    // Final text
    if (item.status === 'completed' && item.finalText) {
      const MAX_FINAL_LINES = 20
      const finalLines = item.finalText.split('\n')
      lines += Math.min(MAX_FINAL_LINES, finalLines.length)
      if (finalLines.length > MAX_FINAL_LINES) lines += 1 // truncation note
    }

    lines += 1 // margin-bottom
    return lines
  }

  return 1
}

function buildItemMeta(items: TimelineItem[], columns: number): ItemMeta[] {
  const meta: ItemMeta[] = []
  let lineOffset = 0
  for (const item of items) {
    const lineCount = countItemLines(item, columns)
    meta.push({ item, startLine: lineOffset, lineCount })
    lineOffset += lineCount
  }
  return meta
}

// === Phase 2: Render only visible lines (with JSX) ===

function renderItemLines(
  item: TimelineItem,
  columns: number,
  skipLines: number,  // how many lines of this item to skip from the top
  maxLines: number,   // max lines to render
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  if (item.type === 'user-message') {
    const allLines: React.ReactNode[] = []
    allLines.push(<Text key={`${item.id}-mt`}> </Text>)
    allLines.push(
      <Box key={`${item.id}-content`}>
        <Text color="cyan" bold>{'› '}</Text>
        <Text wrap="wrap">{item.content}</Text>
      </Box>
    )
    // Wrapped continuation lines
    const contentCols = Math.max(1, columns - 4)
    const extraLines = Math.max(0, Math.ceil(item.content.length / contentCols) - 1)
    for (let i = 0; i < extraLines; i++) {
      allLines.push(<Text key={`${item.id}-wrap-${i}`}>  </Text>)
    }
    allLines.push(<Text key={`${item.id}-mb`}> </Text>)
    return allLines.slice(skipLines, skipLines + maxLines)
  }

  if (item.type === 'agent-task') {
    return renderAgentTaskLines(item, columns, skipLines, maxLines)
  }

  return nodes
}

function renderAgentTaskLines(
  task: AgentTaskItem,
  columns: number,
  skipLines: number,
  maxLines: number,
): React.ReactNode[] {
  const allLines: React.ReactNode[] = []

  // Margin top
  allLines.push(<Text key={`${task.id}-mt`}> </Text>)

  // Status header
  const statusColor = task.status === 'running' ? 'cyan' : task.status === 'completed' ? 'green' : task.status === 'error' ? 'red' : 'yellow'
  const statusIcon = task.status === 'completed' ? '✓' : task.status === 'error' ? '✗' : '·'
  const toolCount = task.steps.filter(s => s.type === 'tool-call').length
  const elapsed = task.duration ?? (task.startedAt ? Date.now() - task.startedAt : 0)

  let statusText = 'Working…'
  if (task.status === 'completed') statusText = 'Done'
  else if (task.status === 'error') statusText = 'Error'
  else if (task.phase === 'thinking') statusText = 'MiMo is thinking…'
  else if (task.phase === 'streaming-text') statusText = 'MiMo is responding…'
  else if (task.phase === 'executing-tools') statusText = 'MiMo is running tools…'
  else if (task.phase === 'awaiting-approval') statusText = 'Awaiting your approval…'

  allLines.push(
    <Box key={`${task.id}-status`}>
      <Text color={statusColor}>{statusIcon} {statusText}</Text>
      {task.status === 'completed' && toolCount > 0 && (
        <Text color="gray" dimColor>
          {' · '}{toolCount} tool call{toolCount === 1 ? '' : 's'}
          {elapsed > 0 && ` · ${formatDuration(elapsed)}`}
        </Text>
      )}
    </Box>
  )

  // Error
  if (task.status === 'error' && task.error) {
    for (const [i, line] of task.error.split('\n').entries()) {
      allLines.push(
        <Box key={`${task.id}-err-${i}`} marginLeft={2}>
          <Text color="red" wrap="wrap">{line}</Text>
        </Box>
      )
    }
  }

  // Tool steps
  const MAX_VISIBLE_STEPS = 8
  const allToolSteps = task.steps.filter(s => s.type === 'tool-call')
  const visibleSteps = allToolSteps.slice(-MAX_VISIBLE_STEPS)
  const hiddenCount = allToolSteps.length - visibleSteps.length

  if (hiddenCount > 0) {
    allLines.push(
      <Box key={`${task.id}-hidden`} paddingLeft={2}>
        <Text color="cyan" dimColor>
          +{hiddenCount} earlier tool call{hiddenCount === 1 ? '' : 's'}
        </Text>
      </Box>
    )
  }

  for (const step of visibleSteps) {
    const isRunning = step.status === 'running' || step.status === 'pending'
    const isError = step.status === 'error'
    const bulletColor = isRunning ? 'yellow' : isError ? 'red' : 'green'
    const bullet = isRunning ? '⟳' : isError ? '✗' : '✓'
    const tool = step.toolCall

    allLines.push(
      <Box key={step.id} paddingLeft={2}>
        <Text color={bulletColor}>{bullet} </Text>
        <Text color={isError ? 'red' : 'white'} wrap="wrap">
          {tool?.name || step.label}
          {tool?.summary ? `(${tool.summary})` : ''}
        </Text>
        {step.duration != null && step.duration > 0 && (
          <Text color="gray" dimColor>{' '}({formatDuration(step.duration)})</Text>
        )}
      </Box>
    )

    if (!isRunning && tool?.result) {
      const resultText = truncateText(tool.result, 200)
      allLines.push(
        <Box key={`${step.id}-result`} paddingLeft={5}>
          <Text color={isError ? 'red' : 'gray'} dimColor wrap="wrap">
            ⎿ {resultText}
          </Text>
        </Box>
      )
    }
  }

  // Streaming text
  if (task.streamingText && task.status === 'running') {
    const MAX_STREAMING_LINES = 6
    const streamLines = task.streamingText.split('\n')
    const visible = streamLines.slice(-MAX_STREAMING_LINES)
    for (const [i, line] of visible.entries()) {
      allLines.push(
        <Box key={`${task.id}-stream-${i}`} marginLeft={2}>
          <Text wrap="wrap">{line}</Text>
        </Box>
      )
    }
    allLines.push(
      <Box key={`${task.id}-cursor`} marginLeft={2}>
        <Text color="gray" dimColor>▌</Text>
      </Box>
    )
  }

  // Final text
  if (task.status === 'completed' && task.finalText) {
    const MAX_FINAL_LINES = 20
    const finalLines = task.finalText.split('\n')
    const visible = finalLines.slice(0, MAX_FINAL_LINES)
    for (const [i, line] of visible.entries()) {
      allLines.push(
        <Box key={`${task.id}-final-${i}`} marginLeft={2}>
          <Text wrap="wrap">{line}</Text>
        </Box>
      )
    }
    if (finalLines.length > MAX_FINAL_LINES) {
      allLines.push(
        <Box key={`${task.id}-final-trunc`} marginLeft={2}>
          <Text color="gray" dimColor>
            … ({finalLines.length - MAX_FINAL_LINES} more lines)
          </Text>
        </Box>
      )
    }
  }

  // Margin bottom
  allLines.push(<Text key={`${task.id}-mb`}> </Text>)

  return allLines.slice(skipLines, skipLines + maxLines)
}

// === Main Component ===

export function TimelineView({ timeline }: TimelineViewProps) {
  const { stdout } = useStdout()
  const rows = stdout.rows || 24
  const columns = stdout.columns || 80

  // Reserve: UserInput (3) + StatusBar (1) + breathing (2)
  const availableHeight = Math.max(6, rows - 6)
  const items = timeline.items

  // Phase 1: cheap line counting
  const itemMeta = useMemo(() => buildItemMeta(items, columns), [items, columns])
  const totalLines = itemMeta.length > 0
    ? itemMeta[itemMeta.length - 1]!.startLine + itemMeta[itemMeta.length - 1]!.lineCount
    : 0

  const [scrollLineOffset, setScrollLineOffset] = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollRef = useRef(false)

  // Mouse wheel ANSI escape
  useEffect(() => {
    if (stdout.isTTY) {
      stdout.write('\x1b[?1000h')
      stdout.write('\x1b[?1006h')
    }
    return () => {
      if (stdout.isTTY) {
        stdout.write('\x1b[?1000l')
        stdout.write('\x1b[?1006l')
      }
    }
  }, [stdout])

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (!scrollRef.current) {
      setScrollLineOffset(0)
    }
  }, [totalLines])

  const maxScroll = Math.max(0, totalLines - availableHeight)
  const clampedOffset = Math.min(scrollLineOffset, maxScroll)

  // Phase 2: only render visible lines
  const visibleNodes = useMemo(() => {
    const viewStart = Math.max(0, totalLines - availableHeight - clampedOffset)
    const viewEnd = viewStart + availableHeight
    return renderViewport(itemMeta, columns, viewStart, viewEnd)
  }, [itemMeta, columns, totalLines, availableHeight, clampedOffset])

  // Keyboard scrolling
  useInput((input, key) => {
    if (key.ctrl && key.upArrow) {
      setScrollLineOffset(prev => Math.min(prev + 3, maxScroll))
      scrollRef.current = true
      setIsScrolling(true)
    } else if (key.ctrl && key.downArrow) {
      setScrollLineOffset(prev => {
        const next = Math.max(prev - 3, 0)
        if (next === 0) { scrollRef.current = false; setIsScrolling(false) }
        return next
      })
    } else if (key.pageUp) {
      setScrollLineOffset(prev => Math.min(prev + availableHeight, maxScroll))
      scrollRef.current = true
      setIsScrolling(true)
    } else if (key.pageDown) {
      setScrollLineOffset(prev => {
        const next = Math.max(prev - availableHeight, 0)
        if (next === 0) { scrollRef.current = false; setIsScrolling(false) }
        return next
      })
    } else if (input === 'g' && key.ctrl) {
      setScrollLineOffset(maxScroll)
      scrollRef.current = true
      setIsScrolling(true)
    } else if (input === 'e' && key.ctrl) {
      setScrollLineOffset(0)
      scrollRef.current = false
      setIsScrolling(false)
    }
  })

  // Mouse wheel via raw stdin
  useEffect(() => {
    const handleData = (data: Buffer) => {
      const str = data.toString()
      const m = str.match(/\x1b\[<(\d+);(\d+);(\d+)[Mm]/)
      if (m) {
        const btn = parseInt(m[1]!)
        if (btn === 64) {
          setScrollLineOffset(prev => Math.min(prev + 3, maxScroll))
          scrollRef.current = true
          setIsScrolling(true)
        } else if (btn === 65) {
          setScrollLineOffset(prev => {
            const next = Math.max(prev - 3, 0)
            if (next === 0) { scrollRef.current = false; setIsScrolling(false) }
            return next
          })
        }
      }
    }
    if (stdout.isTTY && process.stdin.isTTY) {
      process.stdin.on('data', handleData)
    }
    return () => { process.stdin.off('data', handleData) }
  }, [stdout, maxScroll])

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      {isScrolling && clampedOffset > 0 && (
        <Box justifyContent="center">
          <Text color="cyan" dimColor>
            ▲ {clampedOffset} lines above (Ctrl+↓ to see latest) ▲
          </Text>
        </Box>
      )}

      {visibleNodes}

      {isScrolling && clampedOffset > 0 && (
        <Box justifyContent="center">
          <Text color="green" dimColor>
            ▼ Press Ctrl+↓ to see latest ▼
          </Text>
        </Box>
      )}
    </Box>
  )
}

/**
 * Render only the lines within [viewStart, viewEnd) by finding which
 * items overlap that range and only creating JSX for those items.
 */
function renderViewport(
  meta: ItemMeta[],
  columns: number,
  viewStart: number,
  viewEnd: number,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []

  // Binary search for the first item that overlaps the viewport
  let lo = 0, hi = meta.length - 1, firstVisible = meta.length
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const m = meta[mid]!
    if (m.startLine + m.lineCount <= viewStart) {
      lo = mid + 1
    } else {
      firstVisible = mid
      hi = mid - 1
    }
  }

  for (let idx = firstVisible; idx < meta.length; idx++) {
    const m = meta[idx]!
    if (m.startLine >= viewEnd) break

    // How many lines of this item to skip (it starts before the viewport)
    const skip = Math.max(0, viewStart - m.startLine)
    // How many lines of this item to render
    const take = Math.min(m.lineCount - skip, viewEnd - m.startLine - skip)
    if (take <= 0) continue

    const rendered = renderItemLines(m.item, columns, skip, take)
    for (const node of rendered) {
      nodes.push(node)
    }
  }

  return nodes
}

// === Utilities ===

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}
