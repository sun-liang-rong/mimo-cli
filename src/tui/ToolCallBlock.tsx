// 工具调用展示块 - Claude Code 风格

import React from 'react'
import { Box, Text } from 'ink'
import type { LiveToolCall, ToolStatus } from './types.js'
import { Spinner } from './Spinner.js'

interface ToolCallBlockProps {
  tool: LiveToolCall
  compact?: boolean
}

const TOOL_ICONS: Record<string, string> = {
  Read: '📖',
  Write: '✏️',
  Edit: '🔧',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔎',
}

export function ToolCallBlock({ tool, compact = false }: ToolCallBlockProps) {
  const icon = TOOL_ICONS[tool.name] || '🔧'
  const summary = formatToolSummary(tool.name, tool.args)

  return (
    <Box flexDirection="column" marginY={compact ? 0 : 1}>
      <Box>
        <StatusIndicator status={tool.status} />
        <Text color="cyan">
          {' '}
          {icon} <Text bold>{tool.name}</Text>
        </Text>
        <Text color="gray"> {summary}</Text>
      </Box>
      {tool.result && tool.status !== 'running' && (
        <Box paddingLeft={4} marginTop={0}>
          <Text color={tool.status === 'error' ? 'red' : 'gray'} dimColor>
            {truncate(tool.result, compact ? 120 : 200)}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function StatusIndicator({ status }: { status: ToolStatus }) {
  switch (status) {
    case 'running':
    case 'pending':
      return <Spinner color="yellow" />
    case 'success':
      return <Text color="green">✓</Text>
    case 'error':
      return <Text color="red">✗</Text>
    case 'denied':
      return <Text color="yellow">⊘</Text>
    default:
      return <Text color="gray">·</Text>
  }
}

function formatToolSummary(name: string, args: Record<string, unknown>): string {
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

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

export function formatInputPreview(
  toolName: string,
  input: Record<string, unknown>
): string {
  switch (toolName) {
    case 'Write':
      return `Write to: ${input.file_path}\n\n${String(input.content || '').slice(0, 300)}${
        String(input.content || '').length > 300 ? '…' : ''
      }`
    case 'Edit':
      return `Edit: ${input.file_path}\n\n- ${String(input.old_string || '').slice(0, 80)}\n+ ${String(input.new_string || '').slice(0, 80)}`
    case 'Bash':
      return `$ ${input.command}`
    default:
      return JSON.stringify(input, null, 2).slice(0, 400)
  }
}
