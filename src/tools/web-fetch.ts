// WebFetch 工具 - 抓取网页内容

import type { ToolDefinition } from './types.js'

export interface WebFetchResult {
  url: string
  title: string
  content: string
  contentType: string
  statusCode: number
}

/**
 * 抓取网页内容
 */
async function fetchWebPage(url: string, maxChars: number = 10000): Promise<WebFetchResult> {
  // 验证 URL
  try {
    new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30 秒超时
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MiMo-CLI/0.1.0; +https://github.com/mimo-cli)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const contentType = response.headers.get('content-type') || 'text/html'
    const text = await response.text()
    
    // 提取标题
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : url
    
    // 清理 HTML 内容
    let content = text
    
    // 移除 script 和 style 标签
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // 移除 HTML 标签
    content = content.replace(/<[^>]+>/g, ' ')
    
    // 解码 HTML 实体
    content = content
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
    
    // 清理空白字符
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
    
    // 截断到最大长度
    if (content.length > maxChars) {
      content = content.slice(0, maxChars) + '\n\n... [truncated]'
    }
    
    return {
      url,
      title,
      content,
      contentType,
      statusCode: response.status,
    }
  } catch (error: any) {
    clearTimeout(timeout)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`)
    }
    throw error
  }
}

export const webFetchTool: ToolDefinition = {
  name: 'WebFetch',
  description:
    'Fetch and read content from a web page. Returns the text content of the page. ' +
    'Use this to read documentation, articles, or any web content. ' +
    'HTML tags are stripped and content is returned as plain text.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to fetch',
      },
      max_chars: {
        type: 'number',
        description: 'Maximum characters to return (default: 10000, max: 50000)',
      },
    },
    required: ['url'],
  },
  requiresApproval: false,
  async execute(input) {
    const url = input.url
    const maxChars = Math.min(input.max_chars || 10000, 50000)
    
    if (!url) {
      return {
        success: false,
        output: '',
        error: 'URL is required',
      }
    }
    
    try {
      const result = await fetchWebPage(url, maxChars)
      
      const output = [
        `# ${result.title}`,
        `URL: ${result.url}`,
        `Status: ${result.statusCode}`,
        `Content-Type: ${result.contentType}`,
        '',
        '---',
        '',
        result.content,
      ].join('\n')
      
      return {
        success: true,
        output,
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Failed to fetch URL: ${error.message}`,
      }
    }
  },
}
