import React from 'react';
import { Box, Text } from 'ink';
import { TodoItem } from '../ai/todo.js';

interface TodoBarProps {
  items: TodoItem[];
}

export const TodoBar = React.memo(function TodoBar({ items }: TodoBarProps) {
  if (items.length === 0) return null;

  const completed = items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
  const total = items.length;
  const percent = total > 0 ? Math.round(completed / total * 100) : 0;

  return (
    <Box marginLeft={1} marginTop={0} marginBottom={0}>
      <Text color="yellow" bold>📝 </Text>
      <Text color="white">Todo: </Text>
      <Text color="green">{completed}</Text>
      <Text color="gray">/{total} </Text>
      <Text color={percent > 80 ? 'green' : percent > 50 ? 'yellow' : 'cyan'}>
        ({percent}%)
      </Text>
      {items.filter(i => i.status === 'in_progress').map(item => (
        <Text key={item.id} color="cyan"> ⟳ {item.text.slice(0, 30)}</Text>
      ))}
    </Box>
  );
});
