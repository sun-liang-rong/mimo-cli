// WebSearch 工具 - 搜索网页内容

import type { ToolDefinition } from './types.js'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * 使用 DuckDuckGo Instant Answer API 搜索
 * 注意: 这是一个简化版本，生产环境建议使用 SearXNG 或其他搜索 API
 */
async function searchDuckDuckGo(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query)
  const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MiMo-CLI/0.1.0 (AI Coding Assistant)',
      },
    })
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }
    
    const data = await response.json() as any
    const results: SearchResult[] = []
    
    // 提取 Abstract (如果有的话)
    if (data.Abstract) {
      results.push({
        title: data.Heading || 'DuckDuckGo Instant Answer',
        url: data.AbstractURL || '',
        snippet: data.Abstract,
      })
    }
    
    // 提取 RelatedTopics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
          })
        }
      }
    }
    
    return results
  } catch (error: any) {
    throw new Error(`Search failed: ${error.message}`)
  }
}

/**
 * 使用 Wikipedia API 搜索 (作为备用)
 */
async function searchWikipedia(query: string, maxResults: number = 3): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query)
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MiMo-CLI/0.1.0 (AI Coding Assistant)',
      },
    })
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json() as any
    
    if (data.extract) {
      return [{
        title: data.title || query,
        url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedQuery}`,
        snippet: data.extract.slice(0, 300),
      }]
    }
    
    return []
  } catch {
    return []
  }
}

export const webSearchTool: ToolDefinition = {
  name: 'WebSearch',
  description:
    'Search the web for information. Returns titles, URLs, and snippets from search results. ' +
    'Use this to find documentation, examples, solutions to errors, or any information not available in the local codebase.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 10)',
      },
      search_engine: {
        type: 'string',
        enum: ['duckduckgo', 'wikipedia', 'auto'],
        description: 'Search engine to use (default: auto)',
      },
    },
    required: ['query'],
  },
  requiresApproval: false,
  async execute(input) {
    const query = input.query
    const maxResults = Math.min(input.max_results || 5, 10)
    const searchEngine = input.search_engine || 'auto'
    
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        output: '',
        error: 'Search query cannot be empty',
      }
    }
    
    try {
      let results: SearchResult[] = []
      
      if (searchEngine === 'wikipedia') {
        results = await searchWikipedia(query, maxResults)
      } else if (searchEngine === 'duckduckgo') {
        results = await searchDuckDuckGo(query, maxResults)
      } else {
        // auto: 先尝试 DuckDuckGo，失败则用 Wikipedia
        try {
          results = await searchDuckDuckGo(query, maxResults)
        } catch {
          results = await searchWikipedia(query, maxResults)
        }
      }
      
      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for: "${query}"`,
        }
      }
      
      // 格式化输出
      const output = results.map((r, i) => {
        return [
          `### ${i + 1}. ${r.title}`,
          `URL: ${r.url}`,
          r.snippet,
        ].join('\n')
      }).join('\n\n---\n\n')
      
      return {
        success: true,
        output: `Found ${results.length} results for: "${query}"\n\n${output}`,
      }
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: `Search failed: ${error.message}`,
      }
    }
  },
}
