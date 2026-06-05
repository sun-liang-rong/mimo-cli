// 工具调用时间线可视化 - 显示工具执行的甘特图

import React, { useMemo } from 'react'
import { Box, Text } from 'ink'
import type { TaskStep } from './types.js'
import { TOOL_STATUS_COLORS, formatDuration } from './theme.js'

interface ToolTimelineProps {
  steps: TaskStep[]
  width?: number
}

interface TimelineBar {
  step: TaskStep
  startPercent: number
  widthPercent: number
  color: string
  icon: string
}

export function ToolTimeline({ steps, width = 40 }: ToolTimelineProps) {
  const toolSteps = useMemo(() => 
    steps.filter(s => s.type === 'tool-call' && s.toolCall),
    [steps]
  )

  if (toolSteps.length === 0) return null

  // 计算时间范围
  const timeline = useMemo(() => {
    const startedSteps = toolSteps.filter(s => s.startedAt > 0)
    if (startedSteps.length === 0) return null

    const minTime = Math.min(...startedSteps.map(s => s.startedAt))
    const maxTime = Math.max(
      ...startedSteps.map(s => s.completedAt || Date.now())
    )
    const totalDuration = maxTime - minTime

    if (totalDuration <= 0) return null

    const bars: TimelineBar[] = toolSteps.map(step => {
      const start = step.startedAt - minTime
      const end = (step.completedAt || Date.now()) - minTime
      const startPercent = (start / totalDuration) * 100
      const widthPercent = Math.max(2, ((end - start) / totalDuration) * 100)

      let color: string = TOOL_STATUS_COLORS.pending
      let icon = '▪'
      if (step.status === 'running') {
        color = TOOL_STATUS_COLORS.running
        icon = '▸'
      } else if (step.status === 'completed') {
        color = TOOL_STATUS_COLORS.completed
        icon = '▪'
      } else if (step.status === 'error') {
        color = TOOL_STATUS_COLORS.error
        icon = '▪'
      }

      return {
        step,
        startPercent,
        widthPercent,
        color,
        icon,
      }
    })

    return { bars, totalDuration }
  }, [toolSteps])

  if (!timeline) return null

  const { bars, totalDuration } = timeline

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="gray" dimColor>Timeline </Text>
        <Text color="gray" dimColor>{formatDuration(totalDuration)}</Text>
      </Box>
      
      {/* 时间刻度 */}
      <Box>
        <Text color="gray">├</Text>
        <Text color="gray">{'─'.repeat(width)}</Text>
        <Text color="gray">┤</Text>
      </Box>

      {/* 工具调用条 */}
      {bars.map((bar, i) => {
        const toolName = bar.step.toolCall?.name || 'tool'
        const summary = bar.step.toolCall?.summary || ''
        const label = truncate(toolName + (summary ? ` ${summary}` : ''), 20)
        const duration = bar.step.duration ? formatDuration(bar.step.duration) : ''

        // 计算条的位置，确保所有值都是非负的
        const startPos = Math.max(0, Math.round((bar.startPercent / 100) * width))
        const barWidth = Math.max(1, Math.min(width - startPos, Math.round((bar.widthPercent / 100) * width)))
        const endPos = Math.min(width, startPos + barWidth)
        const remaining = Math.max(0, width - endPos)

        return (
          <Box key={bar.step.id}>
            <Text color="gray">│</Text>
            {startPos > 0 && <Text color="gray">{' '.repeat(startPos)}</Text>}
            <Text color={bar.color}>{'█'.repeat(barWidth)}</Text>
            {remaining > 0 && <Text color="gray">{' '.repeat(remaining)}</Text>}
            <Text color="gray">│</Text>
            <Text color={bar.color}> {bar.icon}</Text>
            <Text color="gray"> {label}</Text>
            {duration && <Text color="gray" dimColor> {duration}</Text>}
          </Box>
        )
      })}

      {/* 底部刻度 */}
      <Box>
        <Text color="gray">└</Text>
        <Text color="gray">{'─'.repeat(width)}</Text>
        <Text color="gray">┘</Text>
      </Box>
    </Box>
  )
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}
