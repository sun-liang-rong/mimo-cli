// Welcome 界面 - Claude Code 风格: ASCII logo 左侧, 提示信息右侧

import React from 'react'
import { Box, Text } from 'ink'
import type { SubAgentConfig } from '../agents/manager.js'

interface WelcomeProps {
  model: string
  workingDir: string
  projectContext?: string
  subAgents?: SubAgentConfig[]
}

const LOGO_LINES = [
  ' ███╗   ███╗██╗███╗   ███╗ ██████╗ ',
  ' ████╗ ████║██║████╗ ████║██╔═══██╗',
  ' ██╔████╔██║██║██╔████╔██║██║   ██║',
  ' ██║╚██╔╝██║██║██║╚██╔╝██║██║   ██║',
  ' ██║ ╚═╝ ██║██║██║ ╚═╝ ██║╚██████╔╝',
  ' ╚═╝     ╚═╝╚═╝╚═╝     ╚═╝ ╚═════╝ ',
]

export function Welcome({ model, workingDir, projectContext, subAgents }: WelcomeProps) {
  const hasProjectContext = projectContext && projectContext.trim().length > 0
  const hasSubAgents = subAgents && subAgents.length > 0
  
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

        {/* Project context indicator */}
        {hasProjectContext && (
          <Box marginTop={1}>
            <Text color="green">✓</Text>
            <Text color="gray"> Project context loaded (MIMO.md)</Text>
          </Box>
        )}

        {/* Sub-agents indicator */}
        {hasSubAgents && (
          <Box marginTop={1}>
            <Text color="green">✓</Text>
            <Text color="gray"> {subAgents.length} sub-agent(s) available: </Text>
            <Text color="cyan">{subAgents.map(a => `@${a.name}`).join(', ')}</Text>
          </Box>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Tips for getting started</Text>
          <Text>  · Ask questions, edit files, or run commands.</Text>
          <Text color="gray">  · Be as specific as possible — MiMo prefers action over guessing.</Text>
          <Text color="gray">  · Reference files with @path/to/file in your message.</Text>
          {hasSubAgents && (
            <Text color="gray">  · Use @agent-name to delegate tasks to specialized agents.</Text>
          )}
          {!hasProjectContext && (
            <Text color="gray">  · Run /init to create a MIMO.md for project-specific context.</Text>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold color="yellow">Commands</Text>
          <Text color="gray">  /help      Show available commands</Text>
          <Text color="gray">  /compact   Compress conversation context</Text>
          <Text color="gray">  /context   Show context window usage</Text>
          <Text color="gray">  /cost      Show cost breakdown</Text>
          <Text color="gray">  /session   Manage sessions</Text>
          <Text color="gray">  /agents    List sub-agents</Text>
          <Text color="gray">  /clear     Reset conversation</Text>
          <Text color="gray">  /exit      Quit MiMo CLI</Text>
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
