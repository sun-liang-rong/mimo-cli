// 多模型支持 - 模型切换 + fallback 链

import type { MiMoConfig } from './types.js'

export interface ModelConfig {
  id: string
  name: string
  baseURL: string
  maxTokens: number
  temperature: number
  priority: number
  enabled: boolean
}

export interface ModelManagerConfig {
  models: ModelConfig[]
  defaultModel: string
  fallbackEnabled: boolean
}

const DEFAULT_MODELS: ModelConfig[] = [
  {
    id: 'MiMo-7B-RL',
    name: 'MiMo-7B-RL',
    baseURL: 'https://api.xiaomimimo.com/v1',
    maxTokens: 4096,
    temperature: 0.7,
    priority: 1,
    enabled: true,
  },
]

export class ModelManager {
  private models: Map<string, ModelConfig> = new Map()
  private currentModelId: string
  private fallbackEnabled: boolean

  constructor(config: Partial<ModelManagerConfig> = {}) {
    const models = config.models && config.models.length > 0 ? config.models : DEFAULT_MODELS
    for (const model of models) {
      this.models.set(model.id, model)
    }
    this.currentModelId = config.defaultModel || models[0]!.id
    this.fallbackEnabled = config.fallbackEnabled ?? true
  }

  /** 获取当前模型配置 */
  getCurrentModel(): ModelConfig {
    return this.models.get(this.currentModelId) || DEFAULT_MODELS[0]
  }

  /** 切换模型 */
  switchModel(modelId: string): boolean {
    if (!this.models.has(modelId)) return false
    this.currentModelId = modelId
    return true
  }

  /** 获取模型的 MiMoConfig */
  getMiMoConfig(apiKey: string): MiMoConfig {
    const model = this.getCurrentModel()
    return {
      apiKey,
      baseURL: model.baseURL,
      model: model.id,
      maxTokens: model.maxTokens,
      temperature: model.temperature,
    }
  }

  /** 获取 fallback 模型列表 */
  getFallbackChain(): ModelConfig[] {
    if (!this.fallbackEnabled) return [this.getCurrentModel()]

    return Array.from(this.models.values())
      .filter(m => m.enabled && m.id !== this.currentModelId)
      .sort((a, b) => a.priority - b.priority)
  }

  /** 添加模型 */
  addModel(model: ModelConfig): void {
    this.models.set(model.id, model)
  }

  /** 移除模型 */
  removeModel(modelId: string): boolean {
    if (modelId === this.currentModelId) return false
    return this.models.delete(modelId)
  }

  /** 列出所有模型 */
  listModels(): ModelConfig[] {
    return Array.from(this.models.values())
  }

  /** 启用/禁用模型 */
  setModelEnabled(modelId: string, enabled: boolean): boolean {
    const model = this.models.get(modelId)
    if (!model) return false
    model.enabled = enabled
    return true
  }
}
