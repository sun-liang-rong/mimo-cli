import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { ChatView } from './components/ChatView.js';

export function App() {
  return (
    <Box flexDirection="column" height="100%">
      <ChatView />
    </Box>
  );
}
