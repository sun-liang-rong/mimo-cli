// API 相关类型定义

export interface MiMoConfig {
  apiKey: string
  baseURL: string
  model: string
  maxTokens: number
  temperature: number
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'done' | 'error'
  content?: string
  tool_call?: ToolCall
  error?: string
}
