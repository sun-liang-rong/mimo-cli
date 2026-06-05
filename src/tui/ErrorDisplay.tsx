// 结构化错误展示组件 - 提供错误分类、建议和操作

import React from 'react'
import { Box, Text } from 'ink'

export type ErrorType = 'api' | 'tool' | 'network' | 'permission' | 'unknown'

interface ErrorDisplayProps {
  error: string
  type?: ErrorType
  suggestion?: string
  details?: string
}

function classifyError(error: string): ErrorType {
  const lower = error.toLowerCase()
  if (lower.includes('permission denied') || lower.includes('access denied') || lower.includes('forbidden')) {
    return 'permission'
  }
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused') || lower.includes('timeout')) {
    return 'network'
  }
  if (lower.includes('api') || lower.includes('rate limit') || lower.includes('401') || lower.includes('403')) {
    return 'api'
  }
  if (lower.includes('tool') || lower.includes('command failed') || lower.includes('execution failed')) {
    return 'tool'
  }
  return 'unknown'
}

function getErrorIcon(type: ErrorType): string {
  switch (type) {
    case 'api': return '🔑'
    case 'tool': return '🔧'
    case 'network': return '🌐'
    case 'permission': return '🔒'
    default: return '❌'
  }
}

function getErrorLabel(type: ErrorType): string {
  switch (type) {
    case 'api': return 'API Error'
    case 'tool': return 'Tool Error'
    case 'network': return 'Network Error'
    case 'permission': return 'Permission Error'
    default: return 'Error'
  }
}

function getErrorColor(type: ErrorType): string {
  switch (type) {
    case 'api': return 'yellow'
    case 'tool': return 'red'
    case 'network': return 'blue'
    case 'permission': return 'yellow'
    default: return 'red'
  }
}

function getSuggestion(type: ErrorType, error: string): string {
  const lower = error.toLowerCase()
  
  if (type === 'permission') {
    return 'Check file permissions or run with appropriate privileges'
  }
  if (type === 'network') {
    return 'Check your internet connection and try again'
  }
  if (type === 'api') {
    if (lower.includes('rate limit')) {
      return 'Wait a moment and try again, or check your API quota'
    }
    if (lower.includes('401') || lower.includes('unauthorized')) {
      return 'Check your API key configuration'
    }
    return 'Check your API configuration and try again'
  }
  if (type === 'tool') {
    return 'Check the command syntax and try again'
  }
  return 'An unexpected error occurred'
}

export function ErrorDisplay({ error, type: propType, suggestion: propSuggestion, details }: ErrorDisplayProps) {
  const type = propType || classifyError(error)
  const icon = getErrorIcon(type)
  const label = getErrorLabel(type)
  const color = getErrorColor(type)
  const suggestion = propSuggestion || getSuggestion(type, error)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} marginY={1}>
      {/* Header */}
      <Box>
        <Text>{icon} </Text>
        <Text bold color={color}>{label}</Text>
      </Box>

      {/* Error message */}
      <Box marginTop={0}>
        <Text color="white">{error}</Text>
      </Box>

      {/* Details if provided */}
      {details && (
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" dimColor>Details:</Text>
          <Text color="gray" dimColor wrap="wrap">{details}</Text>
        </Box>
      )}

      {/* Suggestion */}
      <Box marginTop={1}>
        <Text color="gray">💡 </Text>
        <Text color="gray" italic>{suggestion}</Text>
      </Box>
    </Box>
  )
}
