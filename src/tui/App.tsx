// MiMo CLI - Agent Workbench (Timeline architecture)
// Claude Code style: minimal top bar, chat-style middle, single-line input at bottom.

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
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
import { StreamingMetrics } from './StreamingMetrics.js'
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
import { CostTracker } from '../cost/tracker.js'
import { loadProjectContext, getProjectContextSummary } from '../context/project.js'
import { compressMessages, needsCompression } from '../context/compression.js'
import { loadSubAgents, findSubAgent, executeSubAgent } from '../agents/manager.js'
import type { SubAgentConfig } from '../agents/manager.js'

interface AppProps {
  config: Config
  projectContext?: string
  initialSession?: SessionData
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
    case 'WebSearch': return String(args.query || '').slice(0, 60)
    case 'WebFetch': return String(args.url || '').slice(0, 60)
    default: return JSON.stringify(args).slice(0, 60)
  }
}

/**
 * Rebuild a Timeline from persisted session messages.
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

export function App({ config, projectContext, initialSession }: AppProps) {
  const { exit } = useApp()
  const { stdout } = useStdout()

  const [showWelcome, setShowWelcome] = useState(!initialSession)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [timeline, setTimeline] = useState<Timeline>(
    initialSession ? restoreTimelineFromMessages(initialSession.messages) : createTimeline()
  )
  const [approval, setApproval] = useState<ApprovalRequest | null>(null)
  const [approvalQueue, setApprovalQueue] = useState<ApprovalRequest[]>([])
  const [alwaysAllowTools, setAlwaysAllowTools] = useState<Set<string>>(new Set())
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [tokenCount, setTokenCount] = useState(0)
  const [taskStartTime, setTaskStartTime] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [costSummary, setCostSummary] = useState('')
  const [subAgents, setSubAgents] = useState<SubAgentConfig[]>([])

  const agentRef = useRef<AgentLoop | null>(null)
  const timelineRef = useRef(timeline)
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const approvalQueueRef = useRef<ApprovalRequest[]>([])
  const sessionRef = useRef<SessionData | null>(initialSession || null)
  const sessionStoreRef = useRef(new SessionStore())
  const toolStartRef = useRef<Map<string, number>>(new Map())
  const costTrackerRef = useRef(new CostTracker(config.model || 'MiMo-7B-RL'))

  useEffect(() => {
    timelineRef.current = timeline
  }, [timeline])

  // Duration timer
  useEffect(() => {
    if (!taskStartTime) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [taskStartTime])

  // Initialize agent + session + sub-agents
  useEffect(() => {
    const systemPrompt = buildSystemPrompt(projectContext)
    agentRef.current = new AgentLoop(config, systemPrompt)
    
    const initSession = async () => {
      if (initialSession) {
        sessionRef.current = initialSession
        return
      }
      
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
    
    const initSubAgents = async () => {
      try {
        const agents = await loadSubAgents()
        setSubAgents(agents)
      } catch {
        // 忽略加载错误
      }
    }
    
    initSession().catch(() => {})
    initSubAgents().catch(() => {})
  }, [config, projectContext, initialSession])

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

      // 检查是否是子代理调用 (@agent-name)
      const agentMatch = text.match(/^@(\w[\w-]*)\s+(.+)$/s)
      if (agentMatch) {
        const agentName = agentMatch[1]
        const agentMessage = agentMatch[2]
        
        const subAgent = findSubAgent(subAgents, agentName)
        if (subAgent) {
          await handleSubAgentCall(subAgent, agentMessage)
          return
        }
      }

      const slash = handleSlashCommand(text)
      if (slash.handled) {
        if (slash.message === '__CLEAR__') {
          setTimeline(createTimeline())
          setExpandedSteps(new Set())
          setTokenCount(0)
          costTrackerRef.current.reset()
          setCostSummary('')
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
        if (slash.message === '__COST__') {
          const report = costTrackerRef.current.renderDetailedReport()
          setTimeline(prev => addUserMessage(prev, report))
          return
        }
        if (slash.message === '__CONTEXT__') {
          const contextInfo = getContextStatus(tokenCount, 32000)
          setTimeline(prev => addUserMessage(prev, contextInfo))
          return
        }
        if (slash.message === '__COMPACT__') {
          await handleCompact()
          return
        }
        if (slash.message === '__SESSIONS__') {
          const sessionList = await getSessionList()
          setTimeline(prev => addUserMessage(prev, sessionList))
          return
        }
        if (slash.message?.startsWith('__RESUME__')) {
          const sessionId = slash.message.replace('__RESUME__', '')
          await handleResumeSession(sessionId)
          return
        }
        if (slash.message === '__INIT__') {
          const result = await handleInitProject()
          setTimeline(prev => addUserMessage(prev, result))
          return
        }
        if (slash.message === '__MEMORY__') {
          const memoryInfo = getProjectMemoryInfo()
          setTimeline(prev => addUserMessage(prev, memoryInfo))
          return
        }
        if (slash.message === '__AGENTS__') {
          const agentsInfo = getAgentsInfo()
          setTimeline(prev => addUserMessage(prev, agentsInfo))
          return
        }
        if (slash.message === '__HELP__') {
          const helpText = getHelpText()
          setTimeline(prev => addUserMessage(prev, helpText))
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

      // 检查是否需要压缩上下文
      if (needsCompression(history)) {
        const { messages: compressed, summary } = compressMessages(history)
        history.length = 0
        history.push(...compressed)
        setTimeline(prev => addUserMessage(prev, `[Context compressed: ${summary}]`))
      }

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
              setCostSummary(costTrackerRef.current.renderStatusBar())
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
              // Check if tool is in always-allow set
              if (alwaysAllowTools.has(toolName)) {
                return Promise.resolve(true)
              }
              
              setTimeline(prev => updateTaskPhase(prev, 'awaiting-approval'))
              return new Promise<boolean>((resolve) => {
                const request: ApprovalRequest = { toolName, input, resolve }
                approvalQueueRef.current = [...approvalQueueRef.current, request]
                setApprovalQueue(approvalQueueRef.current)
                if (!approval) {
                  setApproval(request)
                }
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
    [config, showWelcome, exit, projectContext, tokenCount, subAgents]
  )

  /**
   * 处理子代理调用
   */
  const handleSubAgentCall = useCallback(async (agent: SubAgentConfig, message: string) => {
    busyRef.current = true
    setShowWelcome(false)
    cancelledRef.current = false

    // 添加用户消息
    setTimeline(prev => addUserMessage(prev, `@${agent.name} ${message}`))
    
    // 创建代理任务
    setTimeline(prev => createAgentTask(prev, agent.maxIterations || 10))
    setTaskStartTime(Date.now())

    try {
      const result = await executeSubAgent(
        agent,
        message,
        {
          apiKey: config.apiKey,
          baseURL: config.baseURL,
          model: config.model || 'MiMo-7B-RL',
          maxTokens: 4096,
          temperature: 0.7,
        },
        projectContext
      )

      if (result.success) {
        setTimeline(prev => finalizeLastTask(prev, result.result))
      } else {
        setTimeline(prev => errorTask(prev, result.error || 'Agent execution failed'))
      }
    } catch (err: any) {
      setTimeline(prev => errorTask(prev, err.message || 'Agent execution failed'))
    }

    setTaskStartTime(0)
    busyRef.current = false
  }, [config, projectContext])

  const handleApproval = useCallback(
    (approved: boolean) => {
      if (approval) {
        approval.resolve(approved)
        approvalQueueRef.current = approvalQueueRef.current.filter(r => r !== approval)
        setApprovalQueue(approvalQueueRef.current)
        
        // Process next approval in queue
        const nextApproval = approvalQueueRef.current[0] || null
        setApproval(nextApproval)
        
        if (!nextApproval) {
          setTimeline(prev => updateTaskPhase(prev, 'executing-tools'))
        }
      }
    },
    [approval]
  )

  const handleAlwaysAllow = useCallback(() => {
    if (approval) {
      setAlwaysAllowTools(prev => new Set([...prev, approval.toolName]))
      approval.resolve(true)
      approvalQueueRef.current = approvalQueueRef.current.filter(r => r !== approval)
      setApprovalQueue(approvalQueueRef.current)
      
      // Process next approval in queue
      const nextApproval = approvalQueueRef.current[0] || null
      setApproval(nextApproval)
      
      if (!nextApproval) {
        setTimeline(prev => updateTaskPhase(prev, 'executing-tools'))
      }
    }
  }, [approval])

  const handleAllowAll = useCallback(() => {
    // Resolve all pending approvals
    for (const req of approvalQueueRef.current) {
      req.resolve(true)
    }
    approvalQueueRef.current = []
    setApprovalQueue([])
    setApproval(null)
    setTimeline(prev => updateTaskPhase(prev, 'executing-tools'))
  }, [])

  const handleCompact = useCallback(async () => {
    if (!sessionRef.current) return
    
    const messages = sessionRef.current.messages
    const { messages: compressed, summary, tokensSaved, tokensBefore, tokensAfter } = 
      compressMessages(messages)
    
    sessionRef.current.messages = compressed
    await sessionStoreRef.current.save(sessionRef.current).catch(() => {})
    
    setTimeline(createTimeline())
    setTokenCount(tokensAfter)
    
    const compactReport = [
      '🗜️ Context Compressed',
      '─'.repeat(40),
      `Before: ${tokensBefore.toLocaleString()} tokens`,
      `After:  ${tokensAfter.toLocaleString()} tokens`,
      `Saved:  ${tokensSaved.toLocaleString()} tokens (${Math.round(tokensSaved / tokensBefore * 100)}%)`,
      '',
      `Summary: ${summary}`,
    ].join('\n')
    
    setTimeline(prev => addUserMessage(prev, compactReport))
  }, [])

  const handleResumeSession = useCallback(async (sessionId: string) => {
    const store = sessionStoreRef.current
    let session = await store.load(sessionId)
    
    if (!session) {
      const sessions = await store.list()
      session = sessions.find(s => s.id.startsWith(sessionId)) || null
    }
    
    if (!session) {
      setTimeline(prev => addUserMessage(prev, `[System] Session not found: ${sessionId}`))
      return
    }
    
    sessionRef.current = session
    setTimeline(restoreTimelineFromMessages(session.messages))
    setShowWelcome(false)
    
    const totalTokens = session.messages.reduce((sum, m) => {
      return sum + (m.content?.length || 0) / 4
    }, 0)
    setTokenCount(Math.floor(totalTokens))
    
    setTimeline(prev => addUserMessage(prev, 
      `[System] Resumed session: ${session!.id}\nModel: ${session!.model} | Messages: ${session!.messages.length}`
    ))
  }, [])

  const handleInitProject = useCallback(async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const mimoPath = path.join(process.cwd(), 'MIMO.md')
    
    try {
      await fs.access(mimoPath)
      return 'MIMO.md already exists. Edit it manually or delete it first.'
    } catch {}
    
    const template = `# ${path.basename(process.cwd())}

## 项目概述
[简要描述项目的目的和功能]

## 技术栈
- 框架: 
- 语言: 
- 数据库: 
- 测试: 

## 常用命令
\`\`\`bash
npm run dev
npm test
npm run build
\`\`\`

## 代码规范
- 缩进: 2 空格
- 命名: camelCase (变量/函数), PascalCase (类/组件)
`
    
    await fs.writeFile(mimoPath, template, 'utf-8')
    return `✅ Created MIMO.md in ${process.cwd()}\nEdit it to add your project context.`
  }, [])

  const getProjectMemoryInfo = useCallback(() => {
    const summary = getProjectContextSummary({ 
      projectMd: '', 
      localMd: '', 
      fullContext: projectContext || '', 
      found: !!projectContext 
    })
    
    const lines = [
      '📋 Project Memory',
      '─'.repeat(40),
      summary,
      '',
      'Context Status:',
      `  Project context: ${projectContext ? '✅ Loaded' : '❌ Not found'}`,
      '',
      'Commands:',
      '  /init     - Create MIMO.md template',
      '  /memory   - Show this info',
      '  /compact  - Compress conversation context',
      '  /agents   - List available sub-agents',
    ]
    
    return lines.join('\n')
  }, [projectContext])

  const getAgentsInfo = useCallback(() => {
    if (subAgents.length === 0) {
      return '📭 No sub-agents found.\n\nCreate agents in .mimo/agents/ directory.'
    }

    const lines = [
      '🤖 Available Sub-Agents',
      '─'.repeat(40),
      '',
    ]

    for (const agent of subAgents) {
      lines.push(`  @${agent.name}`)
      if (agent.description) {
        lines.push(`    ${agent.description}`)
      }
      if (agent.model) {
        lines.push(`    Model: ${agent.model}`)
      }
      if (agent.tools) {
        lines.push(`    Tools: ${agent.tools.join(', ')}`)
      }
      lines.push('')
    }

    lines.push('Usage: @agent-name <your message>')

    return lines.join('\n')
  }, [subAgents])

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      if (busyRef.current) {
        handleCancel()
      } else {
        exit()
      }
    }
    // Ctrl+O: Toggle expansion of all tool call steps
    if (key.ctrl && input === 'o') {
      const task = getActiveTask(timeline)
      if (task) {
        const allStepIds = task.steps
          .filter(s => s.type === 'tool-call' && s.toolCall?.result)
          .map(s => s.id)
        
        if (allStepIds.length === 0) return
        
        const allExpanded = allStepIds.every(id => expandedSteps.has(id))
        if (allExpanded) {
          setExpandedSteps(new Set())
        } else {
          setExpandedSteps(new Set(allStepIds))
        }
      }
    }
  })

  const busy = taskStartTime > 0
  const inputDisabled = busy || !!approval
  const activeTask = getActiveTask(timeline)
  const maxContextTokens = 32000  // TODO: make configurable
  const contextUsage = Math.min(100, Math.round((tokenCount / maxContextTokens) * 100))
  
  // Compute streaming metrics
  const isStreaming = activeTask?.phase === 'streaming-text'
  const charCount = activeTask?.streamingText?.length || 0
  const activeToolCount = activeTask?.steps.filter(s => s.status === 'running').length || 0
  const completedToolCount = activeTask?.steps.filter(s => s.status === 'completed').length || 0
  const totalToolCount = activeTask?.steps.length || 0

  return (
    <Box flexDirection="column" height={stdout.rows}>
      {/* Top bar */}
      <Box flexShrink={0}>
        <StatusBar
          model={config.model || 'MiMo'}
          workingDir={process.cwd()}
          costSummary={costSummary}
          contextUsage={contextUsage}
        />
      </Box>

      {/* Middle: chat history */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {showWelcome && timeline.items.length === 0 ? (
          <Welcome
            model={config.model || 'MiMo-7B-RL'}
            workingDir={process.cwd()}
            projectContext={projectContext}
            subAgents={subAgents}
          />
        ) : (
          <TimelineView
            timeline={timeline}
            expandedSteps={expandedSteps}
            onToggleStep={handleToggleStep}
          />
        )}
      </Box>

      {/* Streaming metrics */}
      {busy && (
        <Box flexShrink={0} paddingX={1}>
          <StreamingMetrics
            isStreaming={!!isStreaming}
            charCount={charCount}
            activeToolCount={activeToolCount}
            completedToolCount={completedToolCount}
            totalToolCount={totalToolCount}
          />
        </Box>
      )}

      {/* Bottom: approval prompt + user input */}
      <Box flexDirection="column" flexShrink={0}>
        {approval && (
          <ToolApproval
            toolName={approval.toolName}
            input={approval.input}
            pendingCount={approvalQueue.length}
            onApprove={() => handleApproval(true)}
            onDeny={() => handleApproval(false)}
            onAlwaysAllow={handleAlwaysAllow}
            onAllowAll={handleAllowAll}
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

function buildSystemPrompt(projectContext?: string): string {
  const cwd = process.cwd()
  const platform = process.platform
  const date = new Date().toISOString().split('T')[0]

  let prompt = `You are MiMo CLI, an expert AI coding assistant in the terminal (similar to Claude Code).

Environment:
- Working directory: ${cwd}
- Platform: ${platform}
- Date: ${date}

You have tools to read, write, and edit files, run shell commands, search the codebase, and search/fetch web content.

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

  if (projectContext) {
    prompt += `\n\nProject Context:\n${projectContext}`
  }

  return prompt
}

function getContextStatus(currentTokens: number, maxTokens: number): string {
  const usagePercent = Math.round((currentTokens / maxTokens) * 100)
  const remaining = maxTokens - currentTokens
  
  let status: string
  let emoji: string
  if (usagePercent < 50) {
    status = 'Healthy'
    emoji = '🟢'
  } else if (usagePercent < 70) {
    status = 'Moderate'
    emoji = '🟡'
  } else if (usagePercent < 85) {
    status = 'High'
    emoji = '🟠'
  } else {
    status = 'Critical'
    emoji = '🔴'
  }

  const barLength = 30
  const filledLength = Math.round((usagePercent / 100) * barLength)
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)

  const lines = [
    `${emoji} Context Window Usage`,
    '─'.repeat(40),
    `Status: ${status}`,
    `Usage:  ${bar} ${usagePercent}%`,
    '',
    `Used:      ${currentTokens.toLocaleString()} tokens`,
    `Remaining: ${remaining.toLocaleString()} tokens`,
    `Total:     ${maxTokens.toLocaleString()} tokens`,
  ]

  if (usagePercent >= 85) {
    lines.push('')
    lines.push('⚠️  Recommendation: Run /compact to compress context')
  }

  return lines.join('\n')
}

async function getSessionList(): Promise<string> {
  const store = new SessionStore()
  const sessions = await store.list()
  
  if (sessions.length === 0) {
    return '📭 No saved sessions found.'
  }

  const lines = [
    '📋 Saved Sessions',
    '─'.repeat(60),
    '',
  ]

  for (const session of sessions.slice(0, 10)) {
    const date = new Date(session.updatedAt).toLocaleString()
    const msgCount = session.messages.length
    const preview = session.messages.find(m => m.role === 'user')?.content?.slice(0, 50) || ''
    
    lines.push(`  ID: ${session.id}`)
    lines.push(`  Model: ${session.model} | Messages: ${msgCount} | Updated: ${date}`)
    if (preview) {
      lines.push(`  Preview: ${preview}...`)
    }
    lines.push('')
  }

  if (sessions.length > 10) {
    lines.push(`... and ${sessions.length - 10} more sessions`)
  }

  lines.push('─'.repeat(60))
  lines.push('Commands: /session resume <id> | /session delete <id> | /session clear')

  return lines.join('\n')
}

function getHelpText(): string {
  return `📖 MiMo CLI Commands
${'─'.repeat(40)}

Session:
  /clear          Clear conversation history
  /session list   List all saved sessions
  /session resume Resume a session by ID
  /session delete Delete a session
  /session clear  Clear all sessions

Context:
  /compact        Compress conversation context
  /context        Show context window usage
  /cost           Show cost breakdown
  /memory         Show project memory info

Project:
  /init           Create MIMO.md template
  /agents         List available sub-agents

System:
  /model          Show current model info
  /help           Show this help message
  /exit           Exit MiMo CLI

Sub-Agents:
  @agent-name     Call a sub-agent (e.g., @code-reviewer review this file)

Keyboard:
  Ctrl+C          Cancel current operation / Exit
  Tab             Toggle shortcuts panel

Approval:
  y               Allow once
  n               Deny once
  a               Always allow (this session)
  Y               Allow all pending

Tips:
  - Use @filename to reference files
  - Use @agent-name to call sub-agents
  - Use /compact when context gets large
  - Create MIMO.md for project-specific context`
}
