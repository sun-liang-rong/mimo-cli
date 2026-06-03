// MiMo CLI - Agent Workbench (Timeline architecture)
// Claude Code style: minimal top bar, chat-style middle, single-line input at bottom.

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Box, useApp, useInput, useStdout } from 'ink'
import { AgentLoop } from '../agent/loop.js'
import type { Message } from '../api/types.js'
import type { Config } from '../config/store.js'
import { SessionStore } from '../session/store.js'
import type { SessionData } from '../session/store.js'
import { Welcome } from './Welcome.js'
import { TimelineView } from './TimelineView.js'
import { UserInput } from './UserInput.js'
import { StatusBar } from './StatusBar.js'
import { ToolApproval } from './ToolApproval.js'
import { handleSlashCommand } from './commands.js'
import {
  createTimeline,
  addUserMessage,
  createAgentTask,
  addStep,
  updateStep,
  completeStep,
  updateTaskPhase,
  appendStreamingText,
  completeTask,
  finalizeLastTask,
  errorTask,
  getActiveTask,
} from './timeline.js'
import type { Timeline, TaskStep } from './types.js'

interface AppProps {
  config: Config
}

type ApprovalRequest = {
  toolName: string
  input: Record<string, unknown>
  resolve: (approved: boolean) => void
}

function formatToolSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'Read': return String(args.file_path || '')
    case 'Write': return String(args.file_path || '')
    case 'Edit': return String(args.file_path || '')
    case 'Bash': return String(args.command || '').slice(0, 60)
    case 'Glob': return String(args.pattern || '')
    case 'Grep': return `${args.pattern || ''} in ${args.path || '.'}`
    case 'Git': return `${args.git_command || args.command || ''} ${args.args || ''}`.trim()
    default: return JSON.stringify(args).slice(0, 60)
  }
}

/**
 * Rebuild a Timeline from persisted session messages.
 * Walks messages in order, emitting user/agent-task items with steps
 * annotated by the matching tool result messages.
 */
function restoreTimelineFromMessages(messages: Message[]): Timeline {
  let timeline = createTimeline()

  for (const msg of messages) {
    if (msg.role === 'user') {
      timeline = addUserMessage(timeline, msg.content || '')
      continue
    }

    if (msg.role === 'assistant') {
      const hasTools = !!(msg.tool_calls && msg.tool_calls.length > 0)
      const hasText = !!msg.content

      if (hasTools) {
        timeline = createAgentTask(timeline, 50)
        for (const tc of msg.tool_calls!) {
          let args: Record<string, unknown> = {}
          try { args = JSON.parse(tc.function.arguments) } catch { args = {} }
          const summary = formatToolSummary(tc.function.name, args)
          const step: TaskStep = {
            id: `step-${tc.id}`,
            type: 'tool-call',
            status: 'completed',
            label: `${tc.function.name} ${summary}`,
            startedAt: 0,
            completedAt: 0,
            toolCall: {
              id: tc.id,
              name: tc.function.name,
              args,
              summary,
            },
          }
          timeline = addStep(timeline, step)
        }
      } else if (hasText) {
        // Either finalize the most recent task with this text, or
        // create a new completed task for a free-form assistant turn.
        const last = timeline.items[timeline.items.length - 1]
        if (last && last.type === 'agent-task') {
          timeline = finalizeLastTask(timeline, msg.content!)
        } else {
          timeline = createAgentTask(timeline, 50)
          timeline = finalizeLastTask(timeline, msg.content!)
        }
      }
      continue
    }

    if (msg.role === 'tool' && msg.tool_call_id) {
      const stepId = `step-${msg.tool_call_id}`
      const content = msg.content || ''
      const isError = content.startsWith('Error:') || content.toLowerCase().includes('permission denied')
      timeline = updateStep(timeline, stepId, {
        toolCall: {
          id: msg.tool_call_id,
          name: msg.name || 'tool',
          args: {},
          summary: isError ? 'Failed' : 'Done',
          result: content.slice(0, 500),
          success: !isError,
        },
      })
    }
  }

  return timeline
}

export function App({ config }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [showWelcome, setShowWelcome] = useState(true)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [timeline, setTimeline] = useState<Timeline>(createTimeline())
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [tokenCount, setTokenCount] = useState(0)
  const [taskStartTime, setTaskStartTime] = useState(0)
  const [now, setNow] = useState(Date.now())

  const agentRef = useRef<AgentLoop | null>(null)
  const timelineRef = useRef(timeline)
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const sessionRef = useRef<SessionData | null>(null)
  const sessionStoreRef = useRef(new SessionStore())
  const toolStartRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    timelineRef.current = timeline
  }, [timeline])

  // Duration timer
  useEffect(() => {
    if (!taskStartTime) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [taskStartTime])

  // Initialize agent + session
  useEffect(() => {
    agentRef.current = new AgentLoop(config, buildSystemPrompt())
    const initSession = async () => {
      const store = sessionStoreRef.current
      const latest = await store.getLatest()
      if (latest && latest.messages.length > 0) {
        sessionRef.current = latest
        setTimeline(restoreTimelineFromMessages(latest.messages))
        setShowWelcome(false)
      } else {
        sessionRef.current = await store.create(config.model || 'MiMo-7B-RL')
      }
    }
    initSession().catch(() => {})
  }, [config])

  const handleToggleStep = useCallback((stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }, [])

  const handleCancel = useCallback(() => {
    if (!busyRef.current) return
    cancelledRef.current = true
    agentRef.current?.cancel()
  }, [])

  const handleUserMessage = useCallback(
    async (text: string) => {
      if (busyRef.current) return

      const slash = handleSlashCommand(text)
      if (slash.handled) {
        if (slash.message === '__CLEAR__') {
          setTimeline(createTimeline())
          setExpandedSteps(new Set())
          setTokenCount(0)
          sessionRef.current = await sessionStoreRef.current.create(config.model || 'MiMo-7B-RL')
          return
        }
        if (slash.message === '__EXIT__') {
          exit()
          return
        }
        if (slash.message === '__MODEL__') {
          setTimeline(prev => addUserMessage(prev, `[System] Model: ${config.model}, API: ${config.baseURL}`))
          return
        }
        if (slash.message) {
          setTimeline(prev => addUserMessage(prev, `[System] ${slash.message}`))
        }
        return
      }

      busyRef.current = true
      if (showWelcome) setShowWelcome(false)
      setShowShortcuts(false)
      cancelledRef.current = false

      // Add user message and create agent task
      setTimeline(prev => {
        let next = addUserMessage(prev, text)
        next = createAgentTask(next, 50)
        return next
      })
      setTaskStartTime(Date.now())
      setExpandedSteps(new Set())

      const userMsg: Message = { role: 'user', content: text }
      const history = [...(sessionRef.current?.messages || []), userMsg]

      let hadError = false

      try {
        const newMessages = await agentRef.current!.sendMessage(
          text,
          history,
          {
            onText: (chunk) => {
              setTimeline(prev => {
                let next = updateTaskPhase(prev, 'streaming-text')
                next = appendStreamingText(next, chunk)
                return next
              })
            },
            onToolCall: (toolCall, args) => {
              const stepId = `step-${toolCall.id}`
              toolStartRef.current.set(toolCall.id, Date.now())
              const summary = formatToolSummary(toolCall.function.name, args)
              const step: TaskStep = {
                id: stepId,
                type: 'tool-call',
                status: 'running',
                label: `${toolCall.function.name} ${summary}`,
                startedAt: Date.now(),
                toolCall: {
                  id: toolCall.id,
                  name: toolCall.function.name,
                  args,
                  summary,
                },
              }
              setTimeline(prev => {
                let next = updateTaskPhase(prev, 'executing-tools')
                next = addStep(next, step)
                return next
              })
            },
            onToolResult: (toolCallId, toolName, result, success) => {
              const stepId = `step-${toolCallId}`
              const startedAt = toolStartRef.current.get(toolCallId) || Date.now()
              const completedAt = Date.now()
              setTimeline(prev => {
                let next = updateStep(prev, stepId, {
                  toolCall: {
                    id: toolCallId,
                    name: toolName,
                    args: {},
                    summary: success ? 'Done' : 'Failed',
                    result: result.slice(0, 500),
                    success,
                    duration: completedAt - startedAt,
                  },
                })
                next = completeStep(next, stepId, success, completedAt)
                return next
              })
              toolStartRef.current.delete(toolCallId)
              setTokenCount(prev => prev + Math.floor(result.length / 4))
            },
            onError: (error) => {
              hadError = true
              setTimeline(prev => errorTask(prev, error))
            },
            onRetry: (_attempt, _error, _delayMs) => {
              setTimeline(prev => {
                const stepId = `retry-${Date.now()}`
                return addStep(prev, {
                  id: stepId,
                  type: 'retry',
                  status: 'completed',
                  label: `Retrying (attempt ${_attempt})`,
                  startedAt: Date.now(),
                  completedAt: Date.now(),
                  duration: _delayMs,
                })
              })
            },
            onDone: () => {
              setTimeline(prev => completeTask(prev))
            },
            onThinking: () => {
              setTimeline(prev => {
                const active = getActiveTask(prev)
                if (active && active.phase !== 'streaming-text') {
                  return updateTaskPhase(prev, 'thinking')
                }
                return prev
              })
            },
            requestApproval: (toolName, input) => {
              setTimeline(prev => updateTaskPhase(prev, 'awaiting-approval'))
              return new Promise<boolean>((resolve) => {
                setApproval({ toolName, input, resolve })
              })
            },
            isCancelled: () => cancelledRef.current,
          }
        )

        // Update session messages
        if (newMessages.length > 0) {
          const updatedHistory = [...history, ...newMessages]
          if (sessionRef.current) {
            sessionRef.current.messages = updatedHistory
            await sessionStoreRef.current.save(sessionRef.current).catch(() => {})
          }
        }
      } catch (err: any) {
        if (!hadError) {
          setTimeline(prev => errorTask(prev, err.message || 'Unknown error'))
        }
      }

      setTaskStartTime(0)
      busyRef.current = false
    },
    [config, showWelcome, exit]
  )

  const handleApproval = useCallback(
    (approved: boolean) => {
      if (approval) {
        approval.resolve(approved)
        setApproval(null)
        setTimeline(prev => updateTaskPhase(prev, 'executing-tools'))
      }
    },
    [approval]
  )

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (busyRef.current) {
        handleCancel()
      } else {
        exit()
      }
    }
  })

  const busy = taskStartTime > 0
  const inputDisabled = busy || !!approval
  const activeTask = getActiveTask(timeline)

  return (
    <Box flexDirection="column" height={stdout.rows}>
      {/* Top bar: model · cwd (Claude Code style, minimal) */}
      <Box flexShrink={0}>
        <StatusBar
          model={config.model || 'MiMo'}
          workingDir={process.cwd()}
        />
      </Box>

      {/* Middle: chat history */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {showWelcome && timeline.items.length === 0 ? (
          <Welcome
            model={config.model || 'MiMo-7B-RL'}
            workingDir={process.cwd()}
          />
        ) : (
          <TimelineView
            timeline={timeline}
            expandedSteps={expandedSteps}
            onToggleStep={handleToggleStep}
          />
        )}
      </Box>

      {/* Bottom: approval prompt (if any) + user input */}
      <Box flexDirection="column" flexShrink={0}>
        {approval && (
          <ToolApproval
            toolName={approval.toolName}
            input={approval.input}
            onApprove={() => handleApproval(true)}
            onDeny={() => handleApproval(false)}
          />
        )}
        <UserInput
          onSubmit={handleUserMessage}
          disabled={inputDisabled}
          showPlaceholder={showWelcome}
          showShortcuts={showShortcuts}
          onToggleShortcuts={() => setShowShortcuts((s) => !s)}
          onCancel={handleCancel}
        />
      </Box>
    </Box>
  )
}

function buildSystemPrompt(): string {
  const cwd = process.cwd()
  const platform = process.platform
  const date = new Date().toISOString().split('T')[0]

  return `You are MiMo CLI, an expert AI coding assistant in the terminal (similar to Claude Code).

Environment:
- Working directory: ${cwd}
- Platform: ${platform}
- Date: ${date}

You have tools to read, write, and edit files, run shell commands, and search the codebase.

Behavior:
- Be direct and helpful. Prefer action over lengthy explanations.
- Use tools proactively to inspect code before making changes.
- When editing, read the file first unless you already have its contents.
- Prefer small, focused edits over rewriting entire files.
- Show concise summaries of what you did after using tools.
- Use markdown for code snippets and structured answers.
- Ask clarifying questions only when truly blocked.

Safety:
- Do not run destructive commands without explicit user request.
- Do not exfiltrate secrets or credentials.`
}
