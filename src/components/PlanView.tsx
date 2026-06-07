import React from 'react';
import { Box, Text } from 'ink';
import { Plan } from '../ai/planner.js';

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  in_progress: '⟳',
  completed: '✓',
  failed: '✗',
  skipped: '⏭',
  blocked: '🔒',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'gray',
  in_progress: 'cyan',
  completed: 'green',
  failed: 'red',
  skipped: 'yellow',
  blocked: 'magenta',
};

interface PlanViewProps {
  plan: Plan | null;
}

export const PlanView = React.memo(function PlanView({ plan }: PlanViewProps) {
  if (!plan) return null;

  const completed = plan.items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
  const total = plan.items.length;
  const percent = total > 0 ? Math.round(completed / total * 100) : 0;
  const barWidth = 30;
  const filled = Math.round(barWidth * percent / 100);

  const progressBar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const barColor = percent > 80 ? 'green' : percent > 50 ? 'yellow' : 'cyan';

  return (
    <Box flexDirection="column" marginLeft={1} marginTop={0} marginBottom={0} borderStyle="round" borderColor="cyan" paddingX={1}>
      <Box>
        <Text color="cyan" bold>📋 {plan.title}</Text>
        <Text color="gray"> — {plan.status}</Text>
      </Box>
      <Box>
        <Text color={barColor}>{progressBar}</Text>
        <Text color="gray"> {percent}% ({completed}/{total})</Text>
      </Box>
      {plan.items.map((item, i) => (
        <Box key={item.id}>
          <Text color={STATUS_COLORS[item.status]}>{STATUS_ICONS[item.status]} </Text>
          <Text color={item.status === 'completed' ? 'gray' : 'white'}>
            {i + 1}. {item.step}
          </Text>
          {item.status === 'failed' && item.error && (
            <Text color="red"> — {item.error.slice(0, 80)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
});
