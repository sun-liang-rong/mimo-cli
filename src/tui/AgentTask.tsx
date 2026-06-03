import React from 'react'
import { Box, Text } from 'ink'
import type { AgentTaskItem } from './types.js'
import { TaskStepView } from './TaskStep.js'
import { Spinner } from './Spinner.js'
import { Markdown } from './Markdown.js'

interface AgentTaskViewProps {
  task: AgentTaskItem
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

function statusLabel(status: AgentTaskItem['status'], phase: AgentTaskItem['phase']): { text: string; color: string } {
  switch (status) {
    case 'running': {
      switch (phase) {
        case 'thinking': return { text: 'Thinking', color: 'yellow' }
        case 'streaming-text': return { text: 'Streaming', color: 'green' }
        case 'executing-tools': return { text: 'Running', color: 'cyan' }
        case 'awaiting-approval': return { text: 'Awaiting', color: 'yellow' }
        case 'planning': return { text: 'Planning', color: 'blue' }
        default: return { text: 'Running', color: 'cyan' }
      }
    }
    case 'completed': return { text: 'Completed', color: 'green' }
    case 'error': return { text: 'Error', color: 'red' }
    case 'cancelled': return { text: 'Cancelled', color: 'yellow' }
    default: return { text: 'Pending', color: 'gray' }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function AgentTaskView({ task, expandedSteps, onToggleStep }: AgentTaskViewProps) {
  const { text: statusText, color: statusColor } = statusLabel(task.status, task.phase)
  const elapsed = task.duration ?? (Date.now() - task.startedAt)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={task.status === 'error' ? 'red' : task.status === 'running' ? 'cyan' : 'gray'}
      paddingX={1}
      marginY={1}
    >
      {/* Header */}
      <Box>
        {task.status === 'running'
          ? <Spinner color={statusColor} />
          : <Text color={statusColor}>{'●'}</Text>
        }
        <Text color={statusColor} bold> {statusText}</Text>
        {task.iterationCount > 0 && (
          <Text color="gray"> · Iter {task.iterationCount}/{task.maxIterations}</Text>
        )}
        {elapsed > 0 && (
          <Text color="gray" dimColor> · {formatDuration(elapsed)}</Text>
        )}
      </Box>

      {/* Steps */}
      {task.steps.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {task.steps.map(step => (
            <Box key={step.id} paddingLeft={1}>
              <TaskStepView
                step={step}
                expanded={expandedSteps.has(step.id)}
                onToggle={() => onToggleStep(step.id)}
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Streaming text */}
      {task.streamingText && (
        <Box flexDirection="column" marginTop={1}>
          <Markdown content={task.streamingText} />
          {task.status === 'running' && <Text color="gray" dimColor>{'▌'}</Text>}
        </Box>
      )}

      {/* Final text (if different from streaming) */}
      {task.finalText && task.finalText !== task.streamingText && (
        <Box flexDirection="column" marginTop={1}>
          <Markdown content={task.finalText} />
        </Box>
      )}
    </Box>
  )
}
