import React from 'react'
import { Box, Text } from 'ink'
import type { TaskStep } from './types.js'
import { ToolDetail } from './ToolDetail.js'
import { Spinner } from './Spinner.js'

interface TaskStepViewProps {
  step: TaskStep
  expanded: boolean
  onToggle: () => void
}

function StepIcon({ status }: { status: TaskStep['status'] }) {
  switch (status) {
    case 'running':
      return <Spinner color="yellow" />
    case 'completed':
      return <Text color="green">{'✓'}</Text>
    case 'error':
      return <Text color="red">{'✗'}</Text>
    case 'denied':
      return <Text color="yellow">{'⊘'}</Text>
    default:
      return <Text color="gray">{'○'}</Text>
  }
}

export function TaskStepView({ step, expanded }: TaskStepViewProps) {
  if (step.type === 'tool-call' && step.toolCall) {
    return (
      <Box flexDirection="column">
        <ToolDetail
          tool={step.toolCall}
          status={step.status}
          expanded={expanded}
          reasoning={step.reasoning}
        />
      </Box>
    )
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
