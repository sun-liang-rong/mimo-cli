// 工具审批 - Claude Code 风格: 内联一行, 不使用大黄框

import React from 'react'
import { Box, Text, useInput } from 'ink'
import { formatInputPreview } from './ToolCallBlock.js'

interface ToolApprovalProps {
  toolName: string
  input: Record<string, unknown>
  onApprove: () => void
  onDeny: () => void
}

export function ToolApproval({
  toolName,
  input,
  onApprove,
  onDeny,
}: ToolApprovalProps) {
  useInput((inputKey, key) => {
    if (inputKey === 'y' || inputKey === 'Y' || key.return) {
      onApprove()
    }
    if (inputKey === 'n' || inputKey === 'N' || key.escape) {
      onDeny()
    }
  })

  const preview = formatInputPreview(toolName, input)

  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      <Box>
        <Text color="yellow" bold>⚠ Permission requested</Text>
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
          <Text bold color="green" inverse> yes </Text>
          <Text color="gray">  </Text>
          <Text bold color="red" inverse> no </Text>
          <Text color="gray">  (y/n)</Text>
        </Text>
      </Box>
    </Box>
  )
}
