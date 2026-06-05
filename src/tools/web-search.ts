// WebSearch 工具 - 搜索网页内容

import type { ToolDefinition } from './types.js'

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Brave Search API (primary, needs BRAVE_API_KEY env var)
 */
async function searchBrave(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    throw new Error('BRAVE_API_KEY environment variable is not set')
  }

  const encodedQuery = encodeURIComponent(query)
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=${maxResults}`

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  })

  if (!response.ok) {
    throw new Error(`Brave Search failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as any
  const results: SearchResult[] = []

  if (data.web?.results) {
    for (const item of data.web.results.slice(0, maxResults)) {
      results.push({
        title: item.title || '',
        url: item.url || '',
        snippet: item.description || '',
      })
    }
  }

  return results
}

/**
 * DuckDuckGo HTML scraping fallback (no API key needed)
 * Fetches the lite HTML version and parses results with regex.
 */
async function searchDuckDuckGoHTML(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const encodedQuery = encodeURIComponent(query)
  const url = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
    },
  })

  if (!response.ok) {
    throw new Error(`DuckDuckGo HTML search failed: ${response.status}`)
  }

  const html = await response.text()
  const results: SearchResult[] = []

  // DuckDuckGo lite page uses a table layout.
  // Result links: <a rel="nofollow" href="URL" class='result-link'>TITLE</a>
  // Snippets in <td class='result-snippet'>...</td>
  //
  // We try multiple patterns to be robust across DDG HTML variations.

  // Pattern 1: Match result-link anchors and their following snippet cells
  const resultLinkRegex = /<a[^>]*rel="nofollow"[^>]*href="([^"]*)"[^>]*class=['"]result-link['"][^>]*>([^<]*)<\/a>/gi
  const snippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi

  // Extract all links first
  const links: { url: string; title: string }[] = []
  let match: RegExpExecArray | null

  while ((match = resultLinkRegex.exec(html)) !== null) {
    links.push({ url: match[1], title: stripHtml(match[2]) })
  }

  // Extract all snippets
  const snippets: string[] = []
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(stripHtml(match[1]))
  }

  // Pair them up
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
    })
  }

  // Fallback pattern: if the above didn't match, try a broader pattern
  // DDG lite sometimes uses slightly different markup
  if (results.length === 0) {
    // Try matching any <a> with an href that looks like a result link (not a DDG internal link)
    const broadLinkRegex = /<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>([^<]{4,})<\/a>/gi
    const broadSnippetRegex = /<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/gi

    const broadLinks: { url: string; title: string }[] = []
    while ((match = broadLinkRegex.exec(html)) !== null) {
      const href = match[1]
      // Skip DDG internal links
      if (href.includes('duckduckgo.com') || href.includes('duck.co')) continue
      broadLinks.push({ url: href, title: stripHtml(match[2]) })
    }

    const broadSnippets: string[] = []
    while ((match = broadSnippetRegex.exec(html)) !== null) {
      broadSnippets.push(stripHtml(match[1]))
    }

    for (let i = 0; i < Math.min(broadLinks.length, maxResults); i++) {
      results.push({
        title: broadLinks[i].title,
        url: broadLinks[i].url,
        snippet: broadSnippets[i] || '',
      })
    }
  }

  if (results.length === 0) {
    throw new Error('No results parsed from DuckDuckGo HTML response')
  }

  return results
}

/** Strip HTML tags and decode basic entities */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 使用 Wikipedia API 搜索 (作为最终备用)
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
        enum: ['brave', 'duckduckgo', 'wikipedia', 'auto'],
        description: 'Search engine to use (default: auto). Auto priority: Brave (if BRAVE_API_KEY set) -> DuckDuckGo -> Wikipedia',
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

      if (searchEngine === 'brave') {
        results = await searchBrave(query, maxResults)
      } else if (searchEngine === 'duckduckgo') {
        results = await searchDuckDuckGoHTML(query, maxResults)
      } else if (searchEngine === 'wikipedia') {
        results = await searchWikipedia(query, maxResults)
      } else {
        // auto: Brave (if key available) -> DuckDuckGo HTML -> Wikipedia
        if (process.env.BRAVE_API_KEY) {
          try {
            results = await searchBrave(query, maxResults)
          } catch {
            // Brave failed, try DuckDuckGo
            try {
              results = await searchDuckDuckGoHTML(query, maxResults)
            } catch {
              results = await searchWikipedia(query, maxResults)
            }
          }
        } else {
          // No Brave key, try DuckDuckGo first
          try {
            results = await searchDuckDuckGoHTML(query, maxResults)
          } catch {
            results = await searchWikipedia(query, maxResults)
          }
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
