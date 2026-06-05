// Agent task 渲染 - Claude Code 风格: 无外框, 内联展示, 折叠旧 steps

import React, { useState, useMemo } from 'react'
import { Box, Text } from 'ink'
import type { AgentTaskItem, TaskStep } from './types.js'
import { TaskStepView } from './TaskStep.js'
import { Spinner } from './Spinner.js'
import { Markdown } from './Markdown.js'
import { ErrorDisplay } from './ErrorDisplay.js'
import { ToolTimeline } from './ToolTimeline.js'

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

interface ToolGroup {
  toolName: string
  steps: TaskStep[]
  successCount: number
  errorCount: number
}

function groupToolCalls(steps: TaskStep[]): Array<{ type: 'single'; step: TaskStep } | { type: 'group'; group: ToolGroup }> {
  const result: Array<{ type: 'single'; step: TaskStep } | { type: 'group'; group: ToolGroup }> = []
  let i = 0

  while (i < steps.length) {
    const step = steps[i]!
    if (step.type !== 'tool-call' || !step.toolCall) {
      result.push({ type: 'single', step })
      i++
      continue
    }

    const toolName = step.toolCall.name
    const groupSteps: TaskStep[] = [step]
    let successCount = step.status === 'completed' ? 1 : 0
    let errorCount = step.status === 'error' ? 1 : 0

    // Look ahead for consecutive same-type tool calls
    let j = i + 1
    while (j < steps.length) {
      const next = steps[j]!
      if (next.type !== 'tool-call' || !next.toolCall || next.toolCall.name !== toolName) {
        break
      }
      groupSteps.push(next)
      if (next.status === 'completed') successCount++
      else if (next.status === 'error') errorCount++
      j++
    }

    // Only group if 2+ consecutive same-type calls
    if (groupSteps.length >= 2) {
      result.push({
        type: 'group',
        group: { toolName, steps: groupSteps, successCount, errorCount },
      })
      i = j
    } else {
      result.push({ type: 'single', step })
      i++
    }
  }

  return result
}

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

  // Group consecutive same-type tool calls
  const groupedSteps = useMemo(() => groupToolCalls(visibleSteps), [visibleSteps])

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

      {/* Structured error display */}
      {task.status === 'error' && task.error && (
        <Box marginLeft={2} marginTop={1}>
          <ErrorDisplay error={task.error} />
        </Box>
      )}

      {/* Tool calls (inline, no border) */}
      {groupedSteps.length > 0 && (
        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
          {groupedSteps.map((item, idx) => {
            if (item.type === 'single') {
              return (
                <TaskStepView
                  key={item.step.id}
                  step={item.step}
                  expanded={expandedSteps.has(item.step.id)}
                  onToggle={() => onToggleStep(item.step.id)}
                />
              )
            }

            // Group display
            const { toolName, steps, successCount, errorCount } = item.group
            const allCompleted = steps.every(s => s.status === 'completed' || s.status === 'error')
            const anyRunning = steps.some(s => s.status === 'running')

            return (
              <Box key={`group-${idx}`} flexDirection="column">
                <Box>
                  {anyRunning ? (
                    <Spinner color="cyan" />
                  ) : (
                    <Text color={errorCount > 0 ? 'yellow' : 'green'}>●</Text>
                  )}
                  <Text> </Text>
                  <Text bold>{steps.length}× {toolName}</Text>
                  <Text color="gray" dimColor>
                    {' '}({successCount}✓{errorCount > 0 ? ` ${errorCount}✗` : ''})
                  </Text>
                </Box>
                {/* Show individual steps when expanded */}
                {expandedSteps.has(steps[0]!.id) && (
                  <Box flexDirection="column" paddingLeft={2}>
                    {steps.map(step => (
                      <TaskStepView
                        key={step.id}
                        step={step}
                        expanded={expandedSteps.has(step.id)}
                        onToggle={() => onToggleStep(step.id)}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
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

      {/* Tool timeline visualization (only when completed with multiple visible tools) */}
      {task.status === 'completed' && toolCount >= 3 && visibleSteps.length <= MAX_VISIBLE_STEPS && (
        <Box marginTop={1} paddingLeft={2}>
          <ToolTimeline steps={visibleSteps} />
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
