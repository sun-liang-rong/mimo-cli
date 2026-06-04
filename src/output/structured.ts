// 结构化输出 - JSON Schema 验证和格式化

import type { Message } from '../api/types.js'

export interface StructuredOutputConfig {
  /** JSON Schema 定义 */
  schema: Record<string, any>
  /** 输出格式: json | stream-json */
  format: 'json' | 'stream-json'
  /** 是否包含原始响应 */
  includeRaw?: boolean
}

export interface StructuredResult {
  /** 是否成功 */
  success: boolean
  /** 结构化数据 */
  data?: any
  /** 原始文本响应 */
  rawText?: string
  /** 错误信息 */
  error?: string
  /** 验证错误 */
  validationErrors?: string[]
}

/**
 * 验证 JSON 数据是否符合 Schema
 * 注意: 这是一个简化版本，生产环境建议使用 ajv 等完整库
 */
function validateAgainstSchema(data: any, schema: Record<string, any>): string[] {
  const errors: string[] = []
  
  if (!schema || typeof schema !== 'object') {
    return errors
  }
  
  // 检查类型
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data
    if (actualType !== schema.type) {
      errors.push(`Expected type "${schema.type}", got "${actualType}"`)
      return errors // 类型不匹配，跳过后续检查
    }
  }
  
  // 检查必需字段
  if (schema.required && Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (data === null || data === undefined || !(field in data)) {
        errors.push(`Missing required field: ${field}`)
      }
    }
  }
  
  // 检查属性
  if (schema.properties && typeof data === 'object' && data !== null) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        const propErrors = validateAgainstSchema(data[key], propSchema as Record<string, any>)
        errors.push(...propErrors.map(e => `${key}.${e}`))
      }
    }
  }
  
  // 检查数组元素
  if (schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const itemErrors = validateAgainstSchema(data[i], schema.items)
      errors.push(...itemErrors.map(e => `[${i}].${e}`))
    }
  }
  
  return errors
}

/**
 * 从文本中提取 JSON
 */
function extractJson(text: string): any {
  // 尝试直接解析
  try {
    return JSON.parse(text)
  } catch {}
  
  // 尝试从 markdown 代码块中提取
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1])
    } catch {}
  }
  
  // 尝试查找 JSON 对象或数组
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {}
  }
  
  return null
}

/**
 * 格式化结构化输出
 */
export function formatStructuredOutput(
  messages: Message[],
  config: StructuredOutputConfig
): StructuredResult {
  // 获取最后一条助手消息
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  
  if (!lastAssistant || !lastAssistant.content) {
    return {
      success: false,
      error: 'No assistant response found',
    }
  }
  
  const rawText = lastAssistant.content
  
  // 提取 JSON
  const data = extractJson(rawText)
  
  if (data === null) {
    return {
      success: false,
      error: 'Failed to extract JSON from response',
      rawText,
    }
  }
  
  // 验证 Schema
  if (config.schema) {
    const validationErrors = validateAgainstSchema(data, config.schema)
    
    if (validationErrors.length > 0) {
      return {
        success: false,
        data,
        rawText,
        error: 'Schema validation failed',
        validationErrors,
      }
    }
  }
  
  return {
    success: true,
    data,
    rawText: config.includeRaw ? rawText : undefined,
  }
}

/**
 * 生成 JSON 输出格式
 */
export function generateJsonOutput(result: StructuredResult): string {
  if (result.success) {
    return JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: result.data,
      ...(result.rawText ? { rawText: result.rawText } : {}),
    }, null, 2)
  } else {
    return JSON.stringify({
      type: 'result',
      subtype: 'error',
      error: result.error,
      validationErrors: result.validationErrors,
      ...(result.rawText ? { rawText: result.rawText } : {}),
    }, null, 2)
  }
}

/**
 * 生成流式 JSON 输出格式
 */
export function generateStreamJsonOutput(
  event: { type: string; content?: string; error?: string },
  taskId: string
): string {
  return JSON.stringify({
    type: 'stream_event',
    taskId,
    event,
    timestamp: new Date().toISOString(),
  })
}
