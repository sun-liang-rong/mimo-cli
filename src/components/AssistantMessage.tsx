import React from 'react';
import { Box, Text } from 'ink';
import { Markdown } from './Markdown.js';
import { ToolCallBlock, ToolCallState } from './ToolCallBlock.js';

interface AssistantMessageProps {
  content: string;
  toolCalls: ToolCallState[];
  isStreaming: boolean;
  phase?: 'thinking' | 'planning' | 'executing' | 'verifying';
}

export function AssistantMessage({ content, toolCalls, isStreaming, phase }: AssistantMessageProps) {
  return (
    <Box flexDirection="column" marginLeft={1} marginTop={0} marginBottom={0}>
      <Box borderStyle="single" borderLeft borderLeftColor="cyan" paddingLeft={1} flexDirection="column">
        {content && <Markdown content={content} />}
        {isStreaming && !content && <Text color="gray">{phase === 'planning' ? '📋 Planning...' : phase === 'verifying' ? '🔍 Verifying...' : '...'}</Text>}
        {isStreaming && content && <Text color="cyan">▌</Text>}
      </Box>
      {toolCalls.length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          {toolCalls.map((tc, i) => (
            <ToolCallBlock
              key={tc.toolCall.id || i}
              toolCall={tc.toolCall}
              args={tc.args}
              result={tc.result}
              isRunning={tc.isRunning}
              duration={tc.duration}
              isParallel={tc.isParallel}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

