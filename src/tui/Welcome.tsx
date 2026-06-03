// 欢迎界面 - Claude Code 风格

import React from 'react'
import { Box, Text } from 'ink'

interface WelcomeProps {
  model: string
  workingDir: string
}

export function Welcome({ model, workingDir }: WelcomeProps) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          MiMo CLI
        </Text>
        <Text color="gray"> · AI coding assistant</Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Text bold color="green">
          Ready
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">
            Model: <Text color="cyan">{model}</Text>
          </Text>
          <Text color="gray">
            CWD: <Text>{workingDir}</Text>
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            Getting started
          </Text>
          <Text> Ask questions or describe tasks in the input below.</Text>
          <Text color="gray">
            MiMo can read, edit, and search your codebase, and run shell
            commands (with your approval).
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">
            Shortcuts
          </Text>
          <Text color="gray"> ?  Show all shortcuts</Text>
          <Text color="gray"> /help  Commands · /clear  Reset chat</Text>
          <Text color="gray"> Shift+Enter  Multi-line input</Text>
        </Box>
      </Box>
    </Box>
  )
}
