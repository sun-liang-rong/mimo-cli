import React from 'react'
import { Box, Text } from 'ink'
import type { Timeline, TimelineItem } from './types.js'
import { AgentTaskView } from './AgentTask.js'

interface TimelineViewProps {
  timeline: Timeline
  expandedSteps: Set<string>
  onToggleStep: (stepId: string) => void
}

export function TimelineView({ timeline, expandedSteps, onToggleStep }: TimelineViewProps) {
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      {timeline.items.map(item => (
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
        <Text bold color="blue">You</Text>
        <Box marginTop={0}>
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
