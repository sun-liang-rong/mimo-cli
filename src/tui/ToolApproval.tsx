// 工具审批组件

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
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={1}
      marginX={1}
      marginBottom={1}
    >
      <Text bold color="yellow">
        ⚠ Permission required
      </Text>
      <Box marginTop={1}>
        <Text>
          Allow <Text bold color="cyan">{toolName}</Text>?
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color="gray">Preview:</Text>
        <Box paddingLeft={2} flexDirection="column">
          {preview.split('\n').map((line, i) => (
            <Text key={i} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text bold color="green">Enter/Y</Text> allow ·{' '}
          <Text bold color="red">Esc/N</Text> deny
        </Text>
      </Box>
    </Box>
  )
}
