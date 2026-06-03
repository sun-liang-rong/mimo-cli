// Agent task 渲染 - Claude Code 风格: 无外框, 内联展示, 折叠旧 steps

import React, { useState } from 'react'
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

// Cap on the number of steps shown in full detail; the rest is collapsed
// into a single "+N more tool calls" line. Matches Claude Code's behavior.
const MAX_VISIBLE_STEPS = 8
// Cap on the number of lines the streaming text block may occupy.
const MAX_STREAMING_LINES = 6

function statusLabel(status: AgentTaskItem['status'], phase: AgentTaskItem['phase']): { text: string; color: string } {
  switch (status) {
    case 'running': {
      switch (phase) {
        case 'thinking': return { text: 'MiMo is thinking…', color: 'yellow' }
        case 'streaming-text': return { text: 'MiMo is responding…', color: 'green' }
        case 'executing-tools': return { text: 'MiMo is running tools…', color: 'cyan' }
        case 'awaiting-approval': return { text: 'Awaiting your approval…', color: 'yellow' }
        case 'planning': return { text: 'Planning…', color: 'blue' }
        default: return { text: 'Working…', color: 'cyan' }
      }
    }
    case 'completed': return { text: 'Done', color: 'green' }
    case 'error': return { text: 'Error', color: 'red' }
    case 'cancelled': return { text: 'Cancelled', color: 'yellow' }
    default: return { text: 'Pending', color: 'gray' }
  }
}

function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}m ${seconds}s`
}

export function AgentTaskView({ task, expandedSteps, onToggleStep }: AgentTaskViewProps) {
  const { text: statusText, color: statusColor } = statusLabel(task.status, task.phase)
  const elapsed = task.duration ?? (task.startedAt ? Date.now() - task.startedAt : 0)
  const toolCount = task.steps.filter(s => s.type === 'tool-call').length
  const [showAllSteps, setShowAllSteps] = useState(false)

  const allSteps = task.steps
  const visibleSteps = showAllSteps ? allSteps : allSteps.slice(-MAX_VISIBLE_STEPS)
  const hiddenCount = allSteps.length - visibleSteps.length

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Status header */}
      <Box>
        {task.status === 'running' ? (
          <Spinner color={statusColor} />
        ) : (
          <Text color={statusColor}>{task.status === 'completed' ? '✓' : task.status === 'error' ? '✗' : '·'}</Text>
        )}
        <Text color={statusColor}> {statusText}</Text>
        {task.status === 'completed' && toolCount > 0 && (
          <Text color="gray" dimColor>
            {' · '}{toolCount} tool call{toolCount === 1 ? '' : 's'}
            {elapsed > 0 && ` · ${formatDuration(elapsed)}`}
          </Text>
        )}
      </Box>

      {/* Tool calls (inline, no border) */}
      {visibleSteps.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {visibleSteps.map(step => (
            <TaskStepView
              key={step.id}
              step={step}
              expanded={expandedSteps.has(step.id)}
              onToggle={() => onToggleStep(step.id)}
            />
          ))}
          {hiddenCount > 0 && (
            <Box marginTop={0}>
              <Text color="cyan" dimColor>
                {'  '}+{hiddenCount} earlier tool call{hiddenCount === 1 ? '' : 's'}{' '}
                <Text color="gray" dimColor>(ctrl+o to expand)</Text>
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Final text (completed) */}
      {task.status === 'completed' && task.finalText && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Markdown content={task.finalText} maxLines={20} />
        </Box>
      )}

      {/* Streaming text (running) */}
      {task.streamingText && task.status === 'running' && (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Markdown content={task.streamingText} maxLines={MAX_STREAMING_LINES} />
          <Text color="gray" dimColor>▌</Text>
        </Box>
      )}
    </Box>
  )
}
