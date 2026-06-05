// Agent Loop - 核心对话循环 (集成 context 管理、重试、最大迭代保护、成本追踪、Hook 系统)

import { MiMoClient } from '../api/client.js'
import { ToolRegistry } from '../tools/index.js'
import { ContextManager } from '../context/manager.js'
import { withRetry } from '../api/retry.js'
import type { Message, ToolCall } from '../api/types.js'
import type { MiMoConfig } from '../api/types.js'
import { AgentEventEmitter } from '../tui/events.js'
import { CostTracker } from '../cost/tracker.js'
import { loadHooks, executePreToolHooks, executePostToolHooks } from '../hooks/manager.js'
import type { HookConfig } from '../hooks/manager.js'
import { MemoryStore } from '../memory/store.js'
import { logger } from '../utils/logger.js'
import { getContextWindow } from '../config/models.js'

export interface AgentCallbacks {
  onText: (text: string) => void
  onToolCall: (toolCall: ToolCall, args: Record<string, unknown>) => void
  onToolResult: (
    toolCallId: string,
    toolName: string,
    result: string,
    success: boolean
  ) => void
  onError: (error: string) => void
  onDone: (assistantMessage: Message) => void
  onThinking: () => void
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
  requestApproval: (
    toolName: string,
    input: Record<string, unknown>
  ) => Promise<boolean>
  isCancelled?: () => boolean
}

export interface AgentLoopConfig {
  maxIterations: number
  maxContextTokens: number
  maxToolResultChars: number
  maxRetries: number
  allowedTools?: string[]
}

const DEFAULT_LOOP_CONFIG: AgentLoopConfig = {
  maxIterations: 50,
  maxContextTokens: getContextWindow('MiMo-7B-RL'),
  maxToolResultChars: 50000,
  maxRetries: 3,
}

export class AgentLoop {
  private client: MiMoClient
  private tools: ToolRegistry
  private systemPrompt: string
  private contextManager: ContextManager
  private config: AgentLoopConfig
  private cancelled = false
  private eventEmitter = new AgentEventEmitter()
  private costTracker: CostTracker
  private hooks: HookConfig[] = []
  private memoryStore: MemoryStore

  constructor(
    config: Partial<MiMoConfig>,
    systemPrompt: string,
    loopConfig: Partial<AgentLoopConfig> = {}
  ) {
    this.client = new MiMoClient(config)
    this.tools = new ToolRegistry(loopConfig.allowedTools)
    this.systemPrompt = systemPrompt
    this.config = { ...DEFAULT_LOOP_CONFIG, ...loopConfig }
    this.contextManager = new ContextManager({
      maxContextTokens: this.config.maxContextTokens,
    })
    this.costTracker = new CostTracker(config.model || 'MiMo-7B-RL')
    this.memoryStore = new MemoryStore()
    
    // 异步加载钩子
    this.loadHooksAsync()
    // 异步加载记忆
    this.loadMemory()
  }

  private async loadHooksAsync(): Promise<void> {
    try {
      this.hooks = await loadHooks()
    } catch {
      // 忽略加载错误
    }
  }

  private async loadMemory(): Promise<void> {
    try {
      await this.memoryStore.init()
      const context = this.memoryStore.toPromptContext()
      if (context) {
        this.systemPrompt = this.systemPrompt + '\n\n' + context
      }
    } catch {
      // 忽略记忆加载错误
    }
  }

  cancel(): void {
    this.cancelled = true
    this.client.abort()
  }

  resetCancel(): void {
    this.cancelled = false
  }

  getEventEmitter(): AgentEventEmitter {
    return this.eventEmitter
  }

  getCostTracker(): CostTracker {
    return this.costTracker
  }

  getToolRegistry(): ToolRegistry {
    return this.tools
  }

  async sendMessage(
    _userMessage: string,
    history: Message[],
    callbacks: AgentCallbacks
  ): Promise<Message[]> {
    this.resetCancel()

    logger.debug('sendMessage called', { historyLen: history.length })

    const taskId = `task-${Date.now()}`
    this.eventEmitter.emit({ type: 'agent:start', taskId })

    const messagesForApi: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...history,
    ]

    // Context 管理: 截断历史消息
    const truncatedMessages = this.contextManager.truncateMessages(messagesForApi)

    const toolDefs = this.tools.getToolDefinitions()
    const newMessages: Message[] = []

    try {
      let currentMessages = [...truncatedMessages]
      let iteration = 0

      while (true) {
        // 最大迭代保护 + 自动恢复
        iteration++
        if (iteration > this.config.maxIterations) {
          // 生成当前状态摘要
          const toolSummary = newMessages
            .filter(m => m.role === 'tool')
            .slice(-5)
            .map(m => `- ${m.name}: ${(m.content || '').slice(0, 100)}`)
            .join('\n')

          const recoveryMsg = `Reached maximum iterations (${this.config.maxIterations}). The task may be too complex for a single session.

Recent tool results:
${toolSummary || '(none)'}

You can continue by sending a new message to continue the task from where it left off.`

          const summaryMessage: Message = {
            role: 'assistant',
            content: recoveryMsg,
          }
          newMessages.push(summaryMessage)
          callbacks.onDone(summaryMessage)
          return newMessages
        }

        if (this.cancelled || callbacks.isCancelled?.()) {
          callbacks.onError('Request cancelled')
          this.eventEmitter.emit({ type: 'agent:cancel', taskId })
          return newMessages
        }

        callbacks.onThinking()
        this.eventEmitter.emit({ type: 'agent:thinking', taskId })
        this.eventEmitter.emit({ type: 'agent:iteration', taskId, iteration })

        let assistantContent = ''
        const toolCalls: ToolCall[] = []
        let hasToolCalls = false

        // API 调用带重试
        const events: Array<{ type: string; content?: string; tool_call?: ToolCall; error?: string; usage?: any }> = []
        logger.debug('calling streamChat', { msgs: currentMessages.length, tools: toolDefs.length })
        await withRetry(
          async () => {
            events.length = 0
            for await (const event of this.client.streamChat(currentMessages, toolDefs)) {
              events.push(event)
              if (event.type === 'error') {
                logger.debug('error event', { error: event.error })
                throw new Error(event.error || 'Stream error')
              }
            }
          },
          { maxRetries: this.config.maxRetries },
          (attempt, error, delayMs) => {
            callbacks.onRetry?.(attempt, error, delayMs)
          }
        ).catch((error: Error) => {
          logger.debug('caught error', { message: error.message, eventCount: events.length })
          // 如果重试耗尽仍然失败
          if (events.length === 0) {
            callbacks.onError(error.message || 'Unknown error')
            return
          }
        })

        // 处理收集到的事件
        for (const event of events) {
          if (this.cancelled || callbacks.isCancelled?.()) {
            callbacks.onError('Request cancelled')
            return newMessages
          }

          switch (event.type) {
            case 'text':
              assistantContent += event.content
              callbacks.onText(event.content || '')
              this.eventEmitter.emit({ type: 'agent:text-chunk', taskId, chunk: event.content || '' })
              break

            case 'tool_call':
              hasToolCalls = true
              if (event.tool_call) {
                toolCalls.push(event.tool_call)
                let args: Record<string, unknown> = {}
                try {
                  args = JSON.parse(event.tool_call.function.arguments)
                } catch {
                  args = {}
                }
                callbacks.onToolCall(event.tool_call, args)
                this.eventEmitter.emit({ type: 'agent:tool-call', taskId, toolCall: event.tool_call, args })
              }
              break

            case 'error':
              callbacks.onError(event.error || 'Unknown error')
              this.eventEmitter.emit({ type: 'agent:error', taskId, error: event.error || 'Unknown error' })
              return newMessages

            case 'done':
              // 追踪 token 使用（如果有）
              if (event.usage) {
                this.costTracker.trackFromResponse({ usage: event.usage })
              }
              break
          }
        }

        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        }
        newMessages.push(assistantMessage)

        if (!hasToolCalls || toolCalls.length === 0) {
          callbacks.onDone(assistantMessage)
          this.eventEmitter.emit({ type: 'agent:complete', taskId })
          return newMessages
        }

        // 分离需要审批和不需要审批的工具调用
        const needsApproval: ToolCall[] = []
        const canParallel: ToolCall[] = []

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name
          const tool = this.tools.getTool(toolName)
          if (tool?.requiresApproval) {
            needsApproval.push(toolCall)
          } else {
            canParallel.push(toolCall)
          }
        }

        // 先串行处理需要审批的工具
        for (const toolCall of needsApproval) {
          if (this.cancelled || callbacks.isCancelled?.()) {
            callbacks.onError('Request cancelled')
            return newMessages
          }

          let args: Record<string, unknown> = {}
          try { args = JSON.parse(toolCall.function.arguments) } catch { args = {} }

          const toolName = toolCall.function.name
          
          // 执行 pre-tool 钩子
          const preResult = await executePreToolHooks(toolName, args, this.hooks)
          if (!preResult.continue) {
            const denyMsg: Message = {
              role: 'tool',
              content: `Hook blocked: ${preResult.error}`,
              tool_call_id: toolCall.id,
              name: toolName,
            }
            newMessages.push(denyMsg)
            callbacks.onToolResult(toolCall.id, toolName, `Hook blocked: ${preResult.error}`, false)
            continue
          }
          
          // 使用修改后的输入
          if (preResult.modifiedInput) {
            args = preResult.modifiedInput
          }

          const approved = await callbacks.requestApproval(toolName, args)
          if (!approved) {
            const denyMsg: Message = {
              role: 'tool',
              content: 'User denied permission for this tool call.',
              tool_call_id: toolCall.id,
              name: toolName,
            }
            newMessages.push(denyMsg)
            callbacks.onToolResult(toolCall.id, toolName, 'Permission denied by user', false)
            this.eventEmitter.emit({ type: 'agent:tool-result', taskId, toolCallId: toolCall.id, result: 'Permission denied by user', success: false, duration: 0 })
            continue
          }

          const result = await this.tools.executeTool(toolName, args)
          let resultContent = result.success ? result.output : `Error: ${result.error}`
          
          // 执行 post-tool 钩子
          const postResult = await executePostToolHooks(
            toolName,
            args,
            resultContent,
            result.success,
            this.hooks
          )
          
          if (postResult.modifiedOutput) {
            resultContent = postResult.modifiedOutput
          }
          
          resultContent = this.contextManager.truncateToolResult(resultContent, this.config.maxToolResultChars)

          newMessages.push({ role: 'tool', content: resultContent, tool_call_id: toolCall.id, name: toolName })
          callbacks.onToolResult(toolCall.id, toolName, resultContent, result.success)
          this.eventEmitter.emit({ type: 'agent:tool-result', taskId, toolCallId: toolCall.id, result: resultContent, success: result.success, duration: 0 })
        }

        // 并行执行不需要审批的工具
        if (canParallel.length > 0) {
          const parallelResults = await Promise.allSettled(
            canParallel.map(async (toolCall) => {
              if (this.cancelled || callbacks.isCancelled?.()) return null

              let args: Record<string, unknown> = {}
              try { args = JSON.parse(toolCall.function.arguments) } catch { args = {} }

              const toolName = toolCall.function.name
              
              // 执行 pre-tool 钩子
              const preResult = await executePreToolHooks(toolName, args, this.hooks)
              if (!preResult.continue) {
                return {
                  toolCall,
                  toolName,
                  resultContent: `Hook blocked: ${preResult.error}`,
                  success: false,
                }
              }
              
              // 使用修改后的输入
              if (preResult.modifiedInput) {
                args = preResult.modifiedInput
              }

              callbacks.onToolCall(toolCall, args)
              const result = await this.tools.executeTool(toolName, args)
              let resultContent = result.success ? result.output : `Error: ${result.error}`
              
              // 执行 post-tool 钩子
              const postResult = await executePostToolHooks(
                toolName,
                args,
                resultContent,
                result.success,
                this.hooks
              )
              
              if (postResult.modifiedOutput) {
                resultContent = postResult.modifiedOutput
              }
              
              resultContent = this.contextManager.truncateToolResult(resultContent, this.config.maxToolResultChars)

              return { toolCall, toolName, resultContent, success: result.success }
            })
          )

          for (const settled of parallelResults) {
            if (settled.status === 'fulfilled' && settled.value) {
              const { toolCall, toolName, resultContent, success } = settled.value
              newMessages.push({ role: 'tool', content: resultContent, tool_call_id: toolCall.id, name: toolName })
              callbacks.onToolResult(toolCall.id, toolName, resultContent, success)
              this.eventEmitter.emit({ type: 'agent:tool-result', taskId, toolCallId: toolCall.id, result: resultContent, success, duration: 0 })
            }
          }
        }

        // Context 管理: 重建消息时截断
        currentMessages = this.contextManager.truncateMessages([
          { role: 'system', content: this.systemPrompt },
          ...history,
          ...newMessages,
        ])
      }
    } catch (error: any) {
      callbacks.onError(error.message || 'Unknown error')
      this.eventEmitter.emit({ type: 'agent:error', taskId, error: error.message || 'Unknown error' })
      return newMessages
    }
  }

  getContextManager(): ContextManager {
    return this.contextManager
  }
}
