// MiMo API 客户端 - 基于 OpenAI 兼容接口

import https from 'node:https'
import OpenAI from 'openai'
import type { MiMoConfig, Message, StreamEvent } from './types.js'
import { logger } from '../utils/logger.js'

const DEFAULT_CONFIG: MiMoConfig = {
  apiKey: process.env.MIMO_API_KEY || '',
  baseURL: process.env.MIMO_BASE_URL || 'https://api.mimo.ai/v1',
  model: process.env.MIMO_MODEL || 'MiMo-7B-RL',
  maxTokens: 4096,
  temperature: 0.7,
  allowInsecure: false,
}

export class MiMoClient {
  private client: OpenAI
  private config: MiMoConfig
  private abortController: AbortController | null = null

  constructor(config: Partial<MiMoConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    if (!this.config.apiKey) {
      throw new Error(
        'API key is required. Set MIMO_API_KEY environment variable or pass --api-key'
      )
    }
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      httpAgent: new https.Agent({ rejectUnauthorized: !this.config.allowInsecure }),
    })
  }

  getConfig(): MiMoConfig {
    return { ...this.config }
  }

  /**
   * 取消当前流式请求
   */
  abort(): void {
    this.abortController?.abort()
  }

  /**
   * 流式调用 MiMo API
   */
  async *streamChat(
    messages: Message[],
    tools?: OpenAI.ChatCompletionTool[],
    signal?: AbortSignal
  ): AsyncGenerator<StreamEvent> {
    this.abortController = new AbortController()
    const effectiveSignal = signal || this.abortController.signal

    logger.debug('streamChat called', {
      model: this.config.model,
      baseURL: this.config.baseURL,
      messages: messages.length,
      tools: tools?.length || 0,
    })

    try {
      const params: OpenAI.ChatCompletionCreateParamsStreaming = {
        model: this.config.model,
        messages: messages.map(this.toOpenAIMessage),
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true,
      }

      if (tools && tools.length > 0) {
        params.tools = tools
      }

      logger.debug('API request params', {
        params: JSON.parse(JSON.stringify(params, (key, val) => key === 'tools' ? `[${(val as unknown[]).length} tools]` : val)),
      })

      const stream = await this.client.chat.completions.create(params, {
        signal: effectiveSignal,
      })

      const toolCallAccumulators: Map<
        number,
        { id: string; name: string; arguments: string }
      > = new Map()

      for await (const chunk of stream) {
        if (effectiveSignal.aborted) {
          yield { type: 'error', error: 'Request cancelled' }
          return
        }

        const delta = chunk.choices[0]?.delta
        if (!delta) continue

        // 处理 reasoning_content (MiMo 模型的思考过程)
        // 默认不显示思考过程，只显示最终的 content
        // 如果需要显示思考过程，可以设置环境变量 SHOW_REASONING=1
        const showReasoning = process.env.SHOW_REASONING === '1'
        if (showReasoning && (delta as any).reasoning_content) {
          yield { type: 'text', content: (delta as any).reasoning_content }
        }
        
        if (delta.content) {
          yield { type: 'text', content: delta.content }
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index
            if (!toolCallAccumulators.has(index)) {
              toolCallAccumulators.set(index, {
                id: tc.id || '',
                name: '',
                arguments: '',
              })
            }
            const acc = toolCallAccumulators.get(index)!
            if (tc.id) acc.id = tc.id
            if (tc.function?.name) acc.name = tc.function.name
            if (tc.function?.arguments) acc.arguments += tc.function.arguments
          }
        }

        if (chunk.choices[0]?.finish_reason === 'stop') {
          yield { type: 'done' }
        }

        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          for (const [, acc] of toolCallAccumulators) {
            yield {
              type: 'tool_call',
              tool_call: {
                id: acc.id,
                type: 'function',
                function: {
                  name: acc.name,
                  arguments: acc.arguments,
                },
              },
            }
          }
          yield { type: 'done' }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || effectiveSignal.aborted) {
        yield { type: 'error', error: 'Request cancelled' }
        return
      }
      const detail = error.error?.message || error.body || error.status || ''
      logger.debug('streamChat error', {
        message: error.message,
        status: error.status,
        detail: error.error || error.body || '',
      })
      yield {
        type: 'error',
        error: `${error.message}${detail ? ` — ${detail}` : ''}`,
      }
    } finally {
      this.abortController = null
    }
  }

  private toOpenAIMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content || '' }
    }
    if (msg.role === 'user') {
      return { role: 'user', content: msg.content || '' }
    }
    if (msg.role === 'assistant') {
      const result: OpenAI.ChatCompletionAssistantMessageParam = {
        role: 'assistant',
        content: msg.content,
      }
      if (msg.tool_calls) {
        result.tool_calls = msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }))
      }
      return result
    }
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content || '',
        tool_call_id: msg.tool_call_id || '',
        ...(msg.name ? { name: msg.name } : {}),
      } as OpenAI.ChatCompletionToolMessageParam
    }
    return { role: 'user', content: msg.content || '' }
  }
}
