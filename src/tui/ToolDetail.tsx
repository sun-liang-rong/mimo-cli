import React from 'react'
import { Box, Text } from 'ink'
import type { ToolCallDetail, StepStatus } from './types.js'
import { Spinner } from './Spinner.js'

interface ToolDetailProps {
  tool: ToolCallDetail
  status: StepStatus
  expanded: boolean
  reasoning?: string
}

const TOOL_ICONS: Record<string, string> = {
  Read: '\u{1F4D6}',
  Write: '✏️',
  Edit: '\u{1F527}',
  Bash: '⚡',
  Glob: '\u{1F50D}',
  Grep: '\u{1F50E}',
}

function StatusIcon({ status }: { status: StepStatus }) {
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
      return <Text color="gray">{'·'}</Text>
  }
}

export function ToolDetail({ tool, status, expanded, reasoning }: ToolDetailProps) {
  const icon = TOOL_ICONS[tool.name] || '\u{1F527}'
  const durationStr = tool.duration != null ? formatDurationMs(tool.duration) : ''

  return (
    <Box flexDirection="column" marginY={0}>
      {reasoning && (
        <Box paddingLeft={1}>
          <Text color="gray" dimColor italic>{reasoning}</Text>
        </Box>
      )}
      <Box>
        <StatusIcon status={status} />
        <Text color="cyan"> {icon} </Text>
        <Text bold color="cyan">{tool.name}</Text>
        <Text color="gray"> {tool.summary}</Text>
        {durationStr && <Text color="gray" dimColor> · {durationStr}</Text>}
      </Box>
      {expanded && (
        <Box flexDirection="column" paddingLeft={4} marginTop={0}>
          {Object.keys(tool.args).length > 0 && (
            <Box flexDirection="column">
              <Text color="gray" dimColor>Input:</Text>
              {Object.entries(tool.args).map(([key, value]) => (
                <Text key={key} color="gray" dimColor>
                  {'  '}{key}: {truncate(String(value), 120)}
                </Text>
              ))}
            </Box>
          )}
          {tool.result && (
            <Box flexDirection="column" marginTop={0}>
              <Text color="gray" dimColor>Output:</Text>
              <Text color={status === 'error' ? 'red' : 'gray'} dimColor>
                {'  '}{truncate(tool.result, 200)}
              </Text>
            </Box>
          )}
        </Box>
      )}
      {!expanded && tool.result && status !== 'running' && (
        <Box paddingLeft={4}>
          <Text color={status === 'error' ? 'red' : 'gray'} dimColor>
            {truncate(tool.result, 120)}
          </Text>
        </Box>
      )}
    </Box>
  )
}

export function formatToolSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
      return String(args.file_path || '')
    case 'Write':
      return String(args.file_path || '')
    case 'Edit':
      return String(args.file_path || '')
    case 'Bash':
      return truncate(String(args.command || ''), 60)
    case 'Glob':
      return String(args.pattern || '')
    case 'Grep':
      return `${args.pattern || ''} in ${args.path || '.'}`
    default:
      return truncate(JSON.stringify(args), 60)
  }
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
