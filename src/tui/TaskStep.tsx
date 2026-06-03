// 单个 task step 渲染 - Claude Code 风格: 每个 tool call 压缩到 1-2 行

import React from 'react'
import { Box, Text } from 'ink'
import type { TaskStep } from './types.js'
import { Spinner } from './Spinner.js'

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
          {' · '}{step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
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

  let bulletColor = 'green'
  if (isRunning) bulletColor = 'cyan'
  else if (isError) bulletColor = 'red'
  else if (isDenied) bulletColor = 'yellow'

  const header = (
    <Box>
      <Text>{'  '}</Text>
      {isRunning ? <Spinner color={bulletColor} /> : <Text color={bulletColor}>●</Text>}
      <Text> </Text>
      <Text color={isError ? 'red' : isDenied ? 'yellow' : 'white'} wrap="wrap">
        {tool.name}({tool.summary})
      </Text>
      {step.duration != null && step.duration > 0 && (
        <Text color="gray" dimColor>{' '}({formatDur(step.duration)})</Text>
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
      <Box flexDirection="column" width="100%">
        {header}
        <Box flexDirection="column" width="100%">
          <Text color="gray" dimColor wrap="wrap">
            {'     ⎿ '}{truncate(tool.result, 2000)}
          </Text>
          {tool.args && Object.keys(tool.args).length > 0 && (
            <Box flexDirection="column" width="100%">
              <Text color="gray" dimColor>{'     ⎿ Input:'}</Text>
              {Object.entries(tool.args).slice(0, 6).map(([key, value]) => (
                <Text key={key} color="gray" dimColor wrap="wrap">
                  {'       '}{key}: {truncate(String(value), 120)}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" width="100%">
      {header}
      <Text color={isError ? 'red' : 'gray'} dimColor wrap="wrap">
        {'     ⎿ '}{truncate(tool.result, 200)}
      </Text>
    </Box>
  )
}

function StepIcon({ status }: { status: TaskStep['status'] }) {
  switch (status) {
    case 'running': return <Spinner color="yellow" />
    case 'completed': return <Text color="green">●</Text>
    case 'error': return <Text color="red">●</Text>
    case 'denied': return <Text color="yellow">●</Text>
    default: return <Text color="gray">·</Text>
  }
}

function formatDur(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
