// 单个 task step 渲染 - Claude Code 风格: 每个 tool call 压缩到 1-2 行

import React from 'react'
import { Box, Text } from 'ink'
import type { TaskStep } from './types.js'
import { Spinner } from './Spinner.js'
import { TOOL_STATUS_COLORS, ICONS, formatDuration, truncateText } from './theme.js'

interface TaskStepViewProps {
  step: TaskStep
  expanded: boolean
  onToggle: () => void
}

export function TaskStepView({ step, expanded, onToggle }: TaskStepViewProps) {
  if (step.type === 'tool-call' && step.toolCall) {
    return <ToolCallInline step={step} expanded={expanded} onToggle={onToggle} />
  }

  return (
    <Box>
      <StepIcon status={step.status} />
      <Text color={step.status === 'error' ? 'red' : 'gray'}>
        {' '}{step.label}
      </Text>
      {step.duration != null && step.duration > 0 && (
        <Text color="gray" dimColor>
          {' · '}{formatDuration(step.duration)}
        </Text>
      )}
    </Box>
  )
}

function ToolCallInline({ step, expanded, onToggle }: { step: TaskStep; expanded: boolean; onToggle: () => void }) {
  const tool = step.toolCall!
  const isRunning = step.status === 'running' || step.status === 'pending'
  const isError = step.status === 'error'
  const isDenied = step.status === 'denied'

  let bulletColor: string = TOOL_STATUS_COLORS.completed
  if (isRunning) bulletColor = TOOL_STATUS_COLORS.running
  else if (isError) bulletColor = TOOL_STATUS_COLORS.error
  else if (isDenied) bulletColor = TOOL_STATUS_COLORS.denied

  const header = (
    <Box>
      {isRunning ? (
        <Spinner color={bulletColor} />
      ) : isError ? (
        <Text color={TOOL_STATUS_COLORS.error}>{ICONS.error}</Text>
      ) : isDenied ? (
        <Text color={TOOL_STATUS_COLORS.denied}>{ICONS.warning}</Text>
      ) : (
        <Text color={bulletColor}>{ICONS.success}</Text>
      )}
      <Text> </Text>
      <Text color={isError ? 'red' : isDenied ? 'yellow' : 'white'} wrap="wrap">
        {tool.name}({tool.summary})
      </Text>
      {step.duration != null && step.duration > 0 && (
        <Text color="gray" dimColor>{' '}({formatDuration(step.duration)})</Text>
      )}
    </Box>
  )

  // Running: only the header line. No result line.
  if (isRunning) {
    return <Box flexDirection="column">{header}</Box>
  }

  // No result yet: header only.
  if (!tool.result) {
    return <Box flexDirection="column">{header}</Box>
  }

  // Has result. Two display modes:
  //   collapsed (default): one extra line `⎿ <truncated result>`
  //   expanded: result on its own line + args
  if (expanded) {
    return (
      <Box flexDirection="column">
        {header}
        <Box paddingLeft={3} flexDirection="column">
          <Text color="gray" dimColor wrap="wrap">
            ⎿ {truncateText(tool.result, 2000)}
          </Text>
          {tool.args && Object.keys(tool.args).length > 0 && (
            <Box flexDirection="column" marginTop={0}>
              <Text color="gray" dimColor>⎿ Input:</Text>
              {Object.entries(tool.args).slice(0, 6).map(([key, value]) => (
                <Text key={key} color="gray" dimColor wrap="wrap">
                  {'  '}{key}: {truncateText(String(value), 120)}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {header}
      <Box paddingLeft={3}>
        <Text color={isError ? 'red' : 'gray'} dimColor wrap="wrap">
          ⎿ {truncateText(tool.result, 200)}
        </Text>
        {tool.result.length > 200 && (
          <Text color="cyan" dimColor> (ctrl+o to expand)</Text>
        )}
      </Box>
    </Box>
  )
}

function StepIcon({ status }: { status: TaskStep['status'] }) {
  switch (status) {
    case 'running': return <Spinner color={TOOL_STATUS_COLORS.running} />
    case 'completed': return <Text color={TOOL_STATUS_COLORS.completed}>{ICONS.success}</Text>
    case 'error': return <Text color={TOOL_STATUS_COLORS.error}>{ICONS.error}</Text>
    case 'denied': return <Text color={TOOL_STATUS_COLORS.denied}>{ICONS.warning}</Text>
    default: return <Text color="gray">{ICONS.pending}</Text>
  }
}
