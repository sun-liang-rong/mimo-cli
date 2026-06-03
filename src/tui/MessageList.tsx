// 消息列表 - 稳定渲染

import React from 'react'
import { Box, Text } from 'ink'
import type { ChatEntry, LiveToolCall, AgentStatus } from './types.js'
import { Markdown } from './Markdown.js'
import { ToolCallBlock } from './ToolCallBlock.js'
import { Spinner } from './Spinner.js'

interface MessageListProps {
  entries: ChatEntry[]
  streamingText: string
  liveTools: LiveToolCall[]
  status: AgentStatus
}

export function MessageList({
  entries,
  streamingText,
  liveTools,
  status,
}: MessageListProps) {
  const isActive =
    status === 'thinking' ||
    status === 'streaming' ||
    status === 'running-tool'

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
      {/* 历史消息 */}
      {entries.map((entry) => (
        <ChatEntryView key={entry.id} entry={entry} />
      ))}

      {/* 动态内容：工具调用、流式文本、加载状态 */}
      {liveTools.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {liveTools.map((tool) => (
            <Box key={tool.id} paddingLeft={1}>
              <ToolCallBlock tool={tool} />
            </Box>
          ))}
        </Box>
      )}

      {streamingText && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text bold color="green">
            MiMo
          </Text>
          <Box marginTop={1}>
            <Text wrap="wrap">{streamingText}</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>
              ▌
            </Text>
          </Box>
        </Box>
      )}

      {isActive && !streamingText && liveTools.length === 0 && (
        <Box marginTop={1} marginBottom={1}>
          <Spinner label="MiMo is working..." color="yellow" />
        </Box>
      )}
    </Box>
  )
}

function ChatEntryView({ entry }: { entry: ChatEntry }) {
  switch (entry.kind) {
    case 'user':
      return (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text bold color="blue">
            You
          </Text>
          <Box marginTop={1}>
            <Text wrap="wrap">{entry.content}</Text>
          </Box>
        </Box>
      )

    case 'assistant':
      return (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text bold color="green">
            MiMo
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Markdown content={entry.content} />
          </Box>
        </Box>
      )

    case 'tool':
      return entry.tool ? (
        <Box paddingLeft={1} marginY={1}>
          <ToolCallBlock tool={entry.tool} compact />
        </Box>
      ) : null

    case 'system':
      return (
        <Box flexDirection="column" marginY={1}>
          <Text color="gray" dimColor wrap="wrap">
            {entry.content}
          </Text>
        </Box>
      )

    case 'error':
      return (
        <Box flexDirection="column" marginY={1}>
          <Text color="red" wrap="wrap">
            Error: {entry.content}
          </Text>
        </Box>
      )

    default:
      return null
  }
}
