import React from 'react'
import { Box, Text, useStdout } from 'ink'
import type { Timeline, TimelineItem } from './types.js'
import { AgentTaskView } from './AgentTask.js'

interface TimelineViewProps {
  timeline: Timeline
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

export function TimelineView({ timeline, expandedSteps, onToggleStep }: TimelineViewProps) {
  const { stdout } = useStdout()
  const rows = stdout.rows || 24

  // Reserve space for: UserInput (3 lines) + StatusBar (1 line) + breathing room.
  const availableHeight = Math.max(6, rows - 6)
  const items = timeline.items
  const visibleItems = pickVisibleItems(items, availableHeight)

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      {visibleItems.map(item => (
        <TimelineItemView
          key={item.id}
          item={item}
          expandedSteps={expandedSteps}
          onToggleStep={onToggleStep}
        />
      ))}
    </Box>
  )
}

/**
 * Window the timeline so the most recent item is ALWAYS shown.
 *
 * Bug history: the previous implementation accumulated from the end and
 * set startIdx = i+1 on the first overflow. When the latest item alone
 * exceeded availableHeight, this hid the latest item too, leaving an
 * empty screen even though `metrics.toolCalls` (rendered by the status
 * bar) still reported the calls.
 *
 * Algorithm:
 *   1. If the latest item alone fills the viewport, render just it.
 *   2. Otherwise, accumulate older items while they still fit.
 *   3. Never drop the latest item.
 */
export function pickVisibleItems(items: TimelineItem[], availableHeight: number): TimelineItem[] {
  if (items.length === 0) return []

  const lastIdx = items.length - 1
  const lastLines = estimateItemLines(items[lastIdx]!)

  // 1. Latest item alone fills (or exceeds) the viewport → show only it.
  // Ink's overflow="hidden" on the container will clip the rest visually.
  if (lastLines >= availableHeight) {
    return [items[lastIdx]!]
  }

  // 2. Walk backwards from the second-to-latest, accumulating older items
  //    while they still fit alongside the always-included latest item.
  let total = lastLines
  let startIdx = lastIdx
  for (let i = lastIdx - 1; i >= 0; i--) {
    const lines = estimateItemLines(items[i]!)
    if (total + lines > availableHeight) break
    total += lines
    startIdx = i
  }
  return items.slice(startIdx)
}

function estimateItemLines(item: TimelineItem): number {
  if (item.type === 'user-message') {
    // Inline `> ...` style. Each ~80-char wrap adds one line; minimum 1.
    return Math.max(1, Math.ceil(item.content.length / 80))
  }

  if (item.type === 'agent-task') {
    // 1 header line + marginY={1} (2 lines) + 1 "more" line at most
    let lines = 1 + 2 + 1

    // After folding in AgentTask, only the last 8 steps are rendered in full.
    // We still conservatively count 2 lines per step (header + result preview).
    const VISIBLE_STEPS = 8
    const stepsToCount = Math.min(VISIBLE_STEPS, item.steps.length)
    for (let i = 0; i < stepsToCount; i++) {
      const step = item.steps[i]!
      lines += 1 // step header line
      if (step.toolCall?.result) {
        lines += 1 // one line of result preview
      }
    }

    // Streaming text (capped at 6 lines by AgentTask)
    if (item.streamingText) {
      lines += Math.min(6, Math.ceil(item.streamingText.length / 80))
    }
    // Final text (capped at 20 lines)
    if (item.finalText) {
      lines += Math.min(20, Math.ceil(item.finalText.length / 80))
    }
    return lines
  }

  return 1
}

function TimelineItemView({
  item,
  expandedSteps,
  onToggleStep,
}: {
  item: TimelineItem
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}) {
  if (item.type === 'user-message') {
    return (
      <Box flexDirection="column" marginY={1}>
        <Box>
          <Text color="cyan" bold>{'› '}</Text>
          <Text wrap="wrap">{item.content}</Text>
        </Box>
      </Box>
    )
  }

  if (item.type === 'agent-task') {
    return (
      <AgentTaskView
        task={item}
        expandedSteps={expandedSteps}
        onToggleStep={onToggleStep}
      />
    )
  }

  return null
}
