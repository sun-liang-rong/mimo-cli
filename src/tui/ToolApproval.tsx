// 工具审批 - Claude Code 风格: 内联一行, 不使用大黄框

import React from 'react'
import { Box, Text, useInput } from 'ink'
import { formatInputPreview } from './ToolCallBlock.js'

interface ToolApprovalProps {
  toolName: string
  input: Record<string, unknown>
  pendingCount?: number
  onApprove: () => void
  onDeny: () => void
  onAlwaysAllow: () => void
  onAllowAll: () => void
}

export function ToolApproval({
  toolName,
  input,
  pendingCount = 0,
  onApprove,
  onDeny,
  onAlwaysAllow,
  onAllowAll,
}: ToolApprovalProps) {
  useInput((inputKey, key) => {
    if (inputKey === 'y' || key.return) {
      onApprove()
    }
    if (inputKey === 'n' || key.escape) {
      onDeny()
    }
    if (inputKey === 'a') {
      onAlwaysAllow()
    }
    if (inputKey === 'Y') {
      onAllowAll()
    }
  })

  const preview = formatInputPreview(toolName, input)

  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Box>
        <Text color="yellow" bold>⚠ Permission requested</Text>
        {pendingCount > 1 && (
          <Text color="gray"> ({pendingCount} pending)</Text>
        )}
      </Box>
      <Box marginTop={0} paddingLeft={2}>
        <Text>
          Allow <Text bold color="cyan">{toolName}</Text>?
        </Text>
      </Box>
      {preview && (
        <Box marginTop={0} paddingLeft={2} flexDirection="column">
          {preview.split('\n').slice(0, 6).map((line, i) => (
            <Text key={i} color="gray" dimColor wrap="wrap">
              {line}
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={0} paddingLeft={2}>
        <Text>
          <Text color="gray">  </Text>
          <Text bold color="green" inverse> y </Text>
          <Text color="gray"> allow </Text>
          <Text color="gray">  </Text>
          <Text bold color="red" inverse> n </Text>
          <Text color="gray"> deny </Text>
          <Text color="gray">  </Text>
          <Text bold color="yellow" inverse> a </Text>
          <Text color="gray"> always allow </Text>
          {pendingCount > 1 && (
            <>
              <Text color="gray">  </Text>
              <Text bold color="cyan" inverse> Y </Text>
              <Text color="gray"> allow all ({pendingCount})</Text>
            </>
          )}
        </Text>
      </Box>
    </Box>
  )
}
