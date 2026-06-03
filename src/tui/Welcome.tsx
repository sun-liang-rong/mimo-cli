// Welcome 界面 - Claude Code 风格: ASCII logo 左侧, 提示信息右侧

import React from 'react'
import { Box, Text } from 'ink'

interface WelcomeProps {
  model: string
  workingDir: string
}

const LOGO_LINES = [
  ' ███╗   ███╗██╗███╗   ███╗ ██████╗ ',
  ' ████╗ ████║██║████╗ ████║██╔═══██╗',
  ' ██╔████╔██║██║██╔████╔██║██║   ██║',
  ' ██║╚██╔╝██║██║██║╚██╔╝██║██║   ██║',
  ' ██║ ╚═╝ ██║██║██║ ╚═╝ ██║╚██████╔╝',
  ' ╚═╝     ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ',
]

export function Welcome({ model, workingDir }: WelcomeProps) {
  return (
    <Box flexDirection="row" flexGrow={1} paddingX={2} paddingY={1} gap={4}>
      {/* Left: ASCII logo */}
      <Box flexDirection="column" flexShrink={0}>
        {LOGO_LINES.map((line, i) => (
          <Text key={i} color="cyan" bold>{line}</Text>
        ))}
        <Text color="gray">  · AI coding assistant</Text>
      </Box>

      {/* Right: tips and info */}
      <Box flexDirection="column" flexGrow={1}>
        <Text>
          <Text color="green">●</Text>
          <Text> Ready · </Text>
          <Text color="cyan">{model}</Text>
          <Text color="gray"> · </Text>
          <Text color="gray">{workingDir}</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Tips for getting started</Text>
          <Text>  · Ask questions, edit files, or run commands.</Text>
          <Text color="gray">  · Be as specific as possible — MiMo prefers action over guessing.</Text>
          <Text color="gray">  · Reference files with @path/to/file in your message.</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Commands</Text>
          <Text color="gray">  /help    Show available commands</Text>
          <Text color="gray">  /clear   Reset conversation</Text>
          <Text color="gray">  /exit    Quit MiMo CLI</Text>
        </Box>

        <Box marginTop={1}>
          <Text color="gray">Press </Text>
          <Text color="cyan">?</Text>
          <Text color="gray"> for keyboard shortcuts</Text>
        </Box>
      </Box>
    </Box>
  )
}
