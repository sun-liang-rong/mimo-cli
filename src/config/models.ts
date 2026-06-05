// 模型配置 - 上下文窗口大小、定价、能力

export interface ModelConfig {
  /** 上下文窗口大小 (tokens) */
  contextWindow: number
  /** 最大输出 tokens */
  maxOutputTokens: number
  /** 每百万 token 定价 (USD) */
  pricing: {
    input: number
    output: number
    cacheRead: number
  }
  /** 是否支持工具调用 */
  supportsTools: boolean
  /** 是否支持 reasoning_content */
  supportsReasoning: boolean
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'MiMo-7B-RL': {
    contextWindow: 32768,
    maxOutputTokens: 4096,
    pricing: { input: 0.5, output: 1.5, cacheRead: 0.1 },
    supportsTools: true,
    supportsReasoning: true,
  },
  'MiMo-7B-Chat': {
    contextWindow: 32768,
    maxOutputTokens: 4096,
    pricing: { input: 0.5, output: 1.5, cacheRead: 0.1 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'claude-sonnet-4-6': {
    contextWindow: 200000,
    maxOutputTokens: 8192,
    pricing: { input: 3.0, output: 15.0, cacheRead: 0.3 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'claude-haiku': {
    contextWindow: 200000,
    maxOutputTokens: 4096,
    pricing: { input: 0.25, output: 1.25, cacheRead: 0.03 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'gpt-4o': {
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { input: 2.5, output: 10.0, cacheRead: 1.25 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    maxOutputTokens: 16384,
    pricing: { input: 0.15, output: 0.6, cacheRead: 0.075 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'deepseek-chat': {
    contextWindow: 65536,
    maxOutputTokens: 8192,
    pricing: { input: 0.14, output: 0.28, cacheRead: 0.014 },
    supportsTools: true,
    supportsReasoning: false,
  },
  'deepseek-reasoner': {
    contextWindow: 65536,
    maxOutputTokens: 8192,
    pricing: { input: 0.55, output: 2.19, cacheRead: 0.14 },
    supportsTools: true,
    supportsReasoning: true,
  },
}

const DEFAULT_CONFIG: ModelConfig = {
  contextWindow: 32768,
  maxOutputTokens: 4096,
  pricing: { input: 1.0, output: 3.0, cacheRead: 0.1 },
  supportsTools: true,
  supportsReasoning: false,
}

/**
 * 获取模型配置，支持模糊匹配
 */
export function getModelConfig(model: string): ModelConfig {
  // 精确匹配
  if (MODEL_CONFIGS[model]) return MODEL_CONFIGS[model]

  // 模糊匹配 (忽略大小写)
  const lower = model.toLowerCase()
  for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return config
    }
  }

  // 前缀匹配 (e.g., "MiMo-7B" matches "MiMo-7B-RL")
  for (const [key, config] of Object.entries(MODEL_CONFIGS)) {
    if (key.toLowerCase().startsWith(lower) || lower.startsWith(key.toLowerCase())) {
      return config
    }
  }

  return DEFAULT_CONFIG
}

/**
 * 获取模型上下文窗口大小
 */
export function getContextWindow(model: string): number {
  return getModelConfig(model).contextWindow
}

/**
 * 获取模型定价
 */
export function getModelPricing(model: string): ModelConfig['pricing'] {
  return getModelConfig(model).pricing
}

/**
 * 列出所有已知模型
 */
export function listKnownModels(): string[] {
  return Object.keys(MODEL_CONFIGS)
}

/**
 * 注册自定义模型配置
 */
export function registerModel(name: string, config: ModelConfig): void {
  MODEL_CONFIGS[name] = config
}
