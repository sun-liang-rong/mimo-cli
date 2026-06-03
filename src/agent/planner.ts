// Agent 规划器 - 任务拆解 → 执行计划 → 逐步验证

export interface PlanStep {
  id: number
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  toolCalls: string[]
  result?: string
  error?: string
}

export interface ExecutionPlan {
  goal: string
  steps: PlanStep[]
  currentStep: number
  createdAt: string
  updatedAt: string
}

export class Planner {
  private plan: ExecutionPlan | null = null

  /** 从用户消息创建执行计划 */
  createPlan(goal: string, steps: Array<{ description: string; tools?: string[] }>): ExecutionPlan {
    this.plan = {
      goal,
      steps: steps.map((s, i) => ({
        id: i + 1,
        description: s.description,
        status: 'pending',
        toolCalls: s.tools || [],
      })),
      currentStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return this.plan
  }

  /** 从模型响应中解析计划 */
  parsePlanFromResponse(response: string): ExecutionPlan | null {
    // 尝试解析 markdown 格式的计划
    const steps: Array<{ description: string; tools?: string[] }> = []
    const lines = response.split('\n')

    for (const line of lines) {
      // 匹配编号列表: 1. xxx, 1) xxx, - xxx
      const match = line.match(/^\s*(?:\d+[.)]\s*|[-*]\s+)(.+)/)
      if (match) {
        steps.push({ description: match[1].trim() })
      }
    }

    if (steps.length === 0) return null
    return this.createPlan('Execute plan', steps)
  }

  /** 获取当前步骤 */
  getCurrentStep(): PlanStep | null {
    if (!this.plan) return null
    return this.plan.steps[this.plan.currentStep] || null
  }

  /** 标记当前步骤完成 */
  completeCurrentStep(result?: string): void {
    if (!this.plan) return
    const step = this.plan.steps[this.plan.currentStep]
    if (step) {
      step.status = 'completed'
      step.result = result
      this.plan.currentStep++
      this.plan.updatedAt = new Date().toISOString()
    }
  }

  /** 标记当前步骤失败 */
  failCurrentStep(error: string): void {
    if (!this.plan) return
    const step = this.plan.steps[this.plan.currentStep]
    if (step) {
      step.status = 'failed'
      step.error = error
      this.plan.updatedAt = new Date().toISOString()
    }
  }

  /** 跳过当前步骤 */
  skipCurrentStep(): void {
    if (!this.plan) return
    const step = this.plan.steps[this.plan.currentStep]
    if (step) {
      step.status = 'skipped'
      this.plan.currentStep++
      this.plan.updatedAt = new Date().toISOString()
    }
  }

  /** 检查是否有更多步骤 */
  hasMoreSteps(): boolean {
    if (!this.plan) return false
    return this.plan.currentStep < this.plan.steps.length
  }

  /** 获取计划进度 */
  getProgress(): { completed: number; total: number; percentage: number } {
    if (!this.plan) return { completed: 0, total: 0, percentage: 0 }
    const completed = this.plan.steps.filter(s => s.status === 'completed').length
    return {
      completed,
      total: this.plan.steps.length,
      percentage: Math.round((completed / this.plan.steps.length) * 100),
    }
  }

  /** 获取当前计划 */
  getPlan(): ExecutionPlan | null {
    return this.plan
  }

  /** 格式化计划为可读文本 */
  formatPlan(): string {
    if (!this.plan) return 'No active plan'

    const lines = [`Plan: ${this.plan.goal}`, '']
    for (const step of this.plan.steps) {
      let icon = '○'
      if (step.status === 'completed') icon = '✓'
      else if (step.status === 'failed') icon = '✗'
      else if (step.status === 'in_progress') icon = '►'
      else if (step.status === 'skipped') icon = '⊘'

      lines.push(`  ${icon} ${step.id}. ${step.description}`)
      if (step.result) lines.push(`     → ${step.result.slice(0, 100)}`)
      if (step.error) lines.push(`     ✗ ${step.error.slice(0, 100)}`)
    }

    const progress = this.getProgress()
    lines.push('', `Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`)

    return lines.join('\n')
  }

  /** 重置规划器 */
  reset(): void {
    this.plan = null
  }
}
