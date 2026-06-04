import OpenAI from 'openai'
import fs from 'fs'
import os from 'os'
import path from 'path'

const configPath = path.join(os.homedir(), '.mimo', 'config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
console.log('Config:', { ...config, apiKey: config.apiKey.slice(0, 8) + '...' })

const client = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
})

// 完整的 7 个工具定义（和 app 一模一样）
const tools = [
  {
    type: 'function',
    function: {
      name: 'Read',
      description: 'Read the contents of a file. Returns the file content with line numbers. Supports reading specific line ranges with offset and limit parameters. Use this tool to examine existing files before making changes.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The absolute or relative path to the file to read' },
          offset: { type: 'number', description: 'The line number to start reading from (0-based).' },
          limit: { type: 'number', description: 'The maximum number of lines to read.' },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Write',
      description: 'Create a new file or completely overwrite an existing file with the provided content.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The absolute or relative path to the file to write' },
          content: { type: 'string', description: 'The content to write to the file' },
        },
        required: ['file_path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Edit',
      description: 'Make a targeted edit to an existing file by replacing an exact string match with new content.',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'The absolute or relative path to the file to edit' },
          old_string: { type: 'string', description: 'The exact string to find and replace' },
          new_string: { type: 'string', description: 'The string to replace old_string with' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Bash',
      description: 'Execute a shell command in the user\'s system.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to execute' },
          timeout: { type: 'number', description: 'Optional timeout in milliseconds' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Glob',
      description: 'Find files matching a glob pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The glob pattern to match files against' },
          path: { type: 'string', description: 'The directory to search in.' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Grep',
      description: 'Search file contents using a regex pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The regex pattern to search for' },
          path: { type: 'string', description: 'File or directory to search in.' },
          glob: { type: 'string', description: 'Glob pattern to filter files' },
          context: { type: 'number', description: 'Number of context lines' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'Git',
      description: 'Perform git operations: status, diff, commit, branch, log, show, add, restore.',
      parameters: {
        type: 'object',
        properties: {
          subcommand: { type: 'string', enum: ['status', 'diff', 'branch', 'log', 'commit', 'add', 'restore', 'show'], description: 'The git subcommand' },
          args: { type: 'string', description: 'Additional arguments' },
          message: { type: 'string', description: 'Commit message' },
          files: { type: 'array', items: { type: 'string' }, description: 'Files to operate on' },
        },
        required: ['subcommand'],
      },
    },
  },
]

// 和 app 完全一致的请求
console.log('\n--- Full app-like request (stream) ---')
console.log('Tools count:', tools.length)
console.log('Model:', config.model)
console.log('Temperature: 0.7')
console.log('max_tokens: 4096')

try {
  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: 'You are MiMo CLI, an expert AI coding assistant.' },
      { role: 'user', content: '你好' },
    ],
    max_tokens: 4096,
    temperature: 0.7,
    stream: true,
    tools,
  })

  let text = ''
  let toolCalls = []
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta
    if (delta?.content) text += delta.content
    if (delta?.tool_calls) toolCalls.push(...delta.tool_calls)
    if (chunk.choices[0]?.finish_reason) {
      console.log('finish_reason:', chunk.choices[0].finish_reason)
    }
  }
  console.log('SUCCESS! text:', text.slice(0, 100))
  if (toolCalls.length) console.log('tool_calls:', toolCalls.length)
} catch (e) {
  console.log('FAILED:', e.message)
  console.log('Status:', e.status)
  console.log('Error body:', JSON.stringify(e.error, null, 2))
  console.log('Headers:', JSON.stringify(e.headers, null, 2))
}
