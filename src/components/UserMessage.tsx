import React from 'react';
import { Box, Text } from 'ink';
import { theme, icons } from '../display/theme.js';

interface UserMessageProps {
  content: string;
}

export function UserMessage({ content }: UserMessageProps) {
  const displayContent = content.length > 500 ? content.slice(0, 500) + '...' : content;

  return (
    <Box flexDirection="column" marginLeft={1} marginBottom={0}>
      <Box>
        <Text color="cyan" bold>{icons.prompt} </Text>
        <Text color="white" bold>You</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        {displayContent.split('\n').map((line, i) => (
          <Text key={i} color="white">{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
