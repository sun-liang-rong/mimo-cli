import OpenAI from 'openai';
import { loadResolvedConfig } from '../config/settings.js';
import { APIError } from '../utils/errors.js';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface StreamChunk {
  type: 'content' | 'tool_call_start' | 'tool_call_delta' | 'done';
  data: string;
  toolCallIndex?: number;
  toolCallId?: string;
  toolCallName?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** OpenAI SDK chat completion request structure */
interface ChatCompletionRequest {
  model: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  max_tokens: number;
  temperature: number;
  tools?: OpenAI.Chat.ChatCompletionTool[];
  stream?: boolean;
}

export class MiMoClient {
  private client: OpenAI;
  private config;

  constructor() {
    this.config = loadResolvedConfig();
    if (!this.config.apiKey) {
      throw new APIError('API Key 未配置。请运行: mimo config --api-key <your-api-key>', 401);
    }
    this.client = new OpenAI({ apiKey: this.config.apiKey, baseURL: this.config.baseUrl });
  }

  /** Non-streaming chat call — used for Plan generation, context summarization, etc. */
  async chat(messages: Message[], tools?: OpenAI.Chat.ChatCompletionTool[]): Promise<ChatResponse> {
    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };
    if (tools && tools.length > 0) request.tools = tools;

    try {
      const response = await this.client.chat.completions.create(request) as OpenAI.Chat.ChatCompletion;
      const choice = response.choices[0];
      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls?.filter(tc => tc.type === 'function').map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })) || [],
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 401) throw new APIError('API Key 无效', 401);
      if (err.status === 429) throw new APIError('请求过于频繁', 429);
      throw new APIError(`API 调用失败: ${err.message || String(error)}`, err.status);
    }
  }

  async *streamChat(messages: Message[], tools?: OpenAI.Chat.ChatCompletionTool[]): AsyncGenerator<StreamChunk> {
    const request: ChatCompletionRequest = {
      model: this.config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true,
    };
    if (tools && tools.length > 0) request.tools = tools;

    try {
      const stream = await this.client.chat.completions.create(request) as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
      const toolCallBuffers: Map<number, { id: string; name: string; arguments: string }> = new Map();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;
        if (delta.content) yield { type: 'content', data: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallBuffers.has(idx)) {
              toolCallBuffers.set(idx, { id: tc.id || '', name: '', arguments: '' });
              if (tc.function?.name) {
                toolCallBuffers.get(idx)!.name = tc.function.name;
                yield { type: 'tool_call_start', data: tc.function.name, toolCallIndex: idx, toolCallId: tc.id, toolCallName: tc.function.name };
              }
            }
            const buf = toolCallBuffers.get(idx)!;
            if (tc.id) buf.id = tc.id;
            if (tc.function?.name) buf.name = tc.function.name;
            if (tc.function?.arguments) {
              buf.arguments += tc.function.arguments;
              yield { type: 'tool_call_delta', data: tc.function.arguments, toolCallIndex: idx };
            }
          }
        }
        if (chunk.choices[0]?.finish_reason) yield { type: 'done', data: chunk.choices[0].finish_reason };
      }
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err.status === 401) throw new APIError('API Key 无效', 401);
      if (err.status === 429) throw new APIError('请求过于频繁', 429);
      throw new APIError(`API 调用失败: ${err.message || String(error)}`, err.status);
    }
  }

  getConfig() { return this.config; }
}
