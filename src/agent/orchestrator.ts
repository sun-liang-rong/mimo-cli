// Agent 编排器 - 并行子 agent 机制

import { AgentLoop } from './loop.js'
import type { AgentCallbacks } from './loop.js'
import type { Message, MiMoConfig } from '../api/types.js'

export interface SubTask {
  id: string
  description: string
  messages: Message[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: Message[]
  error?: string
}

export interface OrchestratorConfig {
  maxConcurrent: number
  config: Partial<MiMoConfig>
  systemPrompt: string
}

export class AgentOrchestrator {
  private config: OrchestratorConfig
  private tasks: Map<string, SubTask> = new Map()

  constructor(config: OrchestratorConfig) {
    this.config = config
  }

  /** 创建子任务 */
  createTask(description: string, messages: Message[]): SubTask {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const task: SubTask = { id, description, messages, status: 'pending' }
    this.tasks.set(id, task)
    return task
  }

  /** 并行执行多个子任务 */
  async executeParallel(
    taskIds: string[],
    callbacks: Record<string, Partial<AgentCallbacks>>
  ): Promise<Map<string, Message[]>> {
    const results = new Map<string, Message[]>()

    // 限制并发数
    const chunks: string[][] = []
    for (let i = 0; i < taskIds.length; i += this.config.maxConcurrent) {
      chunks.push(taskIds.slice(i, i + this.config.maxConcurrent))
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (taskId) => {
        const task = this.tasks.get(taskId)
        if (!task) return

        task.status = 'running'
        const agent = new AgentLoop(this.config.config, this.config.systemPrompt)
        const taskCallbacks = callbacks[taskId] || {}

        try {
          const result = await agent.sendMessage(
            task.description,
            task.messages,
            {
              onText: taskCallbacks.onText || (() => {}),
              onToolCall: taskCallbacks.onToolCall || (() => {}),
              onToolResult: taskCallbacks.onToolResult || (() => {}),
              onError: (error) => {
                task.status = 'failed'
                task.error = error
                taskCallbacks.onError?.(error)
              },
              onDone: (msg) => {
                task.status = 'completed'
                taskCallbacks.onDone?.(msg)
              },
              onThinking: taskCallbacks.onThinking || (() => {}),
              requestApproval: taskCallbacks.requestApproval || (async () => false),
              isCancelled: taskCallbacks.isCancelled,
            }
          )

          task.result = result
          results.set(taskId, result)
        } catch (error: any) {
          task.status = 'failed'
          task.error = error.message
        }
      })

      await Promise.allSettled(promises)
    }

    return results
  }

  /** 获取任务状态 */
  getTask(taskId: string): SubTask | undefined {
    return this.tasks.get(taskId)
  }

  /** 获取所有任务 */
  getAllTasks(): SubTask[] {
    return Array.from(this.tasks.values())
  }

  /** 获取任务进度 */
  getProgress(): { completed: number; failed: number; running: number; pending: number; total: number } {
    const tasks = this.getAllTasks()
    return {
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      running: tasks.filter(t => t.status === 'running').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      total: tasks.length,
    }
  }

  /** 重置 */
  reset(): void {
    this.tasks.clear()
  }
}
