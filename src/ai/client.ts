import OpenAI from 'openai';
import { loadConfig, MiMoConfig } from '../config/settings';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
}

export class MiMoClient {
  private client: OpenAI;
  private config: MiMoConfig;

  constructor() {
    this.config = loadConfig();
    
    if (!this.config.apiKey) {
      throw new Error('API Key 未配置。请运行: mimo config --api-key <your-api-key>');
    }
    
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl
    });
  }

  async chat(messages: Message[], tools?: any[]): Promise<ChatResponse> {
    const request: any = {
      model: this.config.model,
      messages: messages as any,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    };

    if (tools && tools.length > 0) {
      request.tools = tools;
    }

    try {
      const response = await this.client.chat.completions.create(request);
      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: (tc as any).function.name,
            arguments: (tc as any).function.arguments
          }
        }))
      };
    } catch (error: any) {
      if (error.status === 401) {
        throw new Error('API Key 无效，请检查配置');
      } else if (error.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      } else if (error.status === 500) {
        throw new Error('服务器错误，请稍后再试');
      } else {
        throw new Error(`API 调用失败: ${error.message}`);
      }
    }
  }

  async *streamChat(messages: Message[], tools?: any[]): AsyncGenerator<string> {
    const request: any = {
      model: this.config.model,
      messages: messages as any,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      stream: true
    };

    if (tools && tools.length > 0) {
      request.tools = tools;
    }

    try {
      const stream = await this.client.chat.completions.create(request) as any;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      if (error.status === 401) {
        throw new Error('API Key 无效，请检查配置');
      } else if (error.status === 429) {
        throw new Error('请求过于频繁，请稍后再试');
      } else {
        throw new Error(`流式 API 调用失败: ${error.message}`);
      }
    }
  }
}