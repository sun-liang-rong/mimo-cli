// Welcome 界面 - Claude Code 风格: 响应式布局适配不同终端尺寸

import React from 'react'
import { Box, Text, useStdout } from 'ink'
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

const LOGO_SMALL = [
  ' ╔╦╗╔═╗╔╦╗',
  '  ║ ║╣  ║ ',
  '  ╩ ╚═╝ ╩ ',
]

function shortenDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const home = process.env.HOME || process.env.USERPROFILE || ''
  let display = dir
  if (home && dir.startsWith(home)) {
    display = '~' + dir.slice(home.length)
  }
  if (display.length <= maxLen) return display
  // Show last N characters
  return '…' + display.slice(-(maxLen - 1))
}

export function Welcome({ model, workingDir, projectContext, subAgents }: WelcomeProps) {
  const { stdout } = useStdout()
  const width = stdout.columns || 80
  const hasProjectContext = projectContext && projectContext.trim().length > 0
  const hasSubAgents = subAgents && subAgents.length > 0
  
  // Responsive layout based on terminal width
  const isWide = width >= 100
  const isMedium = width >= 60
  const dir = shortenDir(workingDir, isWide ? 40 : 20)
  
  // Content components
  const StatusLine = () => (
    <Text>
      <Text color="green">●</Text>
      <Text> Ready · </Text>
      <Text color="cyan">{model}</Text>
      <Text color="gray"> · </Text>
      <Text color="gray">{dir}</Text>
    </Text>
  )

  const ProjectInfo = () => (
    <>
      {hasProjectContext && (
        <Box marginTop={0}>
          <Text color="green">✓</Text>
          <Text color="gray"> Project context loaded</Text>
        </Box>
      )}
      {hasSubAgents && (
        <Box marginTop={0}>
          <Text color="green">✓</Text>
          <Text color="gray"> {subAgents.length} sub-agent(s): </Text>
          <Text color="cyan">{subAgents.map(a => `@${a.name}`).join(', ')}</Text>
        </Box>
      )}
    </>
  )

  const Tips = () => (
    <Box flexDirection="column">
      <Text bold color="yellow">Tips</Text>
      <Text color="gray">  · Ask questions, edit files, or run commands</Text>
      <Text color="gray">  · Reference files with @path/to/file</Text>
      {hasSubAgents && (
        <Text color="gray">  · Use @agent-name to delegate tasks</Text>
      )}
      {!hasProjectContext && (
        <Text color="gray">  · Run /init to create MIMO.md</Text>
      )}
    </Box>
  )

  const Commands = () => (
    <Box flexDirection="column">
      <Text bold color="yellow">Commands</Text>
      {isMedium ? (
        <>
          <Text color="gray">  /help  /compact  /context  /cost</Text>
          <Text color="gray">  /session  /agents  /clear  /exit</Text>
        </>
      ) : (
        <>
          <Text color="gray">  /help     Show commands</Text>
          <Text color="gray">  /compact  Compress context</Text>
          <Text color="gray">  /clear    Reset conversation</Text>
        </>
      )}
    </Box>
  )

  const Shortcuts = () => (
    <Box>
      <Text color="gray">Press </Text>
      <Text color="cyan">?</Text>
      <Text color="gray"> for keyboard shortcuts</Text>
    </Box>
  )

  // Wide layout: logo left, content right
  if (isWide) {
    return (
      <Box flexDirection="row" flexGrow={1} paddingX={2} paddingY={1} gap={4}>
        <Box flexDirection="column" flexShrink={0}>
          {LOGO_LINES.map((line, i) => (
            <Text key={i} color="cyan" bold>{line}</Text>
          ))}
          <Text color="gray">  · AI coding assistant</Text>
        </Box>

        <Box flexDirection="column" flexGrow={1} gap={1}>
          <StatusLine />
          <ProjectInfo />
          <Tips />
          <Commands />
          <Shortcuts />
        </Box>
      </Box>
    )
  }

  // Medium layout: small logo + content stacked
  if (isMedium) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingX={2} paddingY={1} gap={1}>
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column" flexShrink={0}>
            {LOGO_SMALL.map((line, i) => (
              <Text key={i} color="cyan" bold>{line}</Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <StatusLine />
            <ProjectInfo />
          </Box>
        </Box>
        <Tips />
        <Commands />
        <Shortcuts />
      </Box>
    )
  }

  // Narrow layout: no logo, compact text
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1} gap={1}>
      <Text color="cyan" bold>MiMo CLI</Text>
      <StatusLine />
      <ProjectInfo />
      <Tips />
      <Commands />
      <Shortcuts />
    </Box>
  )
}
