import React from 'react';
import { Box, Text } from 'ink';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import { ToolCallState } from './ToolCallBlock.js';

export type MessageType = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCallState[];
  isStreaming: boolean;
};

interface MessageListProps {
  messages: MessageType[];
}

export const MessageList = React.memo(function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column">
      {messages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={0}>
          {msg.role === 'user' ? (
            <UserMessage content={msg.content} />
          ) : (
            <AssistantMessage
              content={msg.content}
              toolCalls={msg.toolCalls}
              isStreaming={msg.isStreaming}
            />
          )}
          <Text> </Text>
        </Box>
      ))}
    </Box>
  );
});
