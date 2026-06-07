import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface ThinkingIndicatorProps {
  visible: boolean;
  phase?: 'thinking' | 'planning' | 'executing' | 'verifying' | 'fixing';
  toolName?: string;
}

const PHASE_LABELS: Record<string, string> = {
  thinking: 'Thinking...',
  planning: 'Planning...',
  executing: 'Executing...',
  verifying: 'Verifying...',
  fixing: 'Auto-fixing...',
};

const PHASE_COLORS: Record<string, string> = {
  thinking: 'cyan',
  planning: 'magenta',
  executing: 'yellow',
  verifying: 'green',
  fixing: 'red',
};

export const ThinkingIndicator = React.memo(function ThinkingIndicator({ visible, phase = 'thinking', toolName }: ThinkingIndicatorProps) {
  if (!visible) return null;

  const label = toolName ? ` Running ${toolName}...` : PHASE_LABELS[phase] || 'Thinking...';
  const color = PHASE_COLORS[phase] || 'cyan';

  return (
    <Box marginLeft={1} marginBottom={0}>
      <Text color={color}>
        <Spinner type="dots" />
      </Text>
      <Text color={color}>
        {label}
      </Text>
    </Box>
  );
});
