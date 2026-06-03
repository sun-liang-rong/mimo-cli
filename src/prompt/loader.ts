// Prompt Loader - 加载 CLAUDE.md / .mimo/CLAUDE.md 项目上下文

import fs from 'fs/promises'
import path from 'path'

export interface ProjectContext {
  /** 项目根目录的 CLAUDE.md 内容 */
  rootInstructions: string
  /** .mimo/ 目录下的额外指令 */
  mimoInstructions: string
  /** 合并后的完整项目上下文 */
  fullContext: string
}

const CONTEXT_FILENAMES = ['CLAUDE.md', 'CLAUDE.local.md']
const MIMO_DIR = '.mimo'

/** 在目录中查找上下文文件 */
async function findContextFiles(dir: string): Promise<string[]> {
  const found: string[] = []
  for (const name of CONTEXT_FILENAMES) {
    try {
      const filePath = path.join(dir, name)
      await fs.access(filePath)
      found.push(filePath)
    } catch {
      // 文件不存在
    }
  }
  return found
}

/** 读取文件内容，失败返回空字符串 */
async function readFileSafe(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/** 向上查找项目根目录 (包含 .git 的目录) */
async function findProjectRoot(startDir: string): Promise<string> {
  let dir = startDir
  while (true) {
    try {
      await fs.access(path.join(dir, '.git'))
      return dir
    } catch {
      const parent = path.dirname(dir)
      if (parent === dir) return startDir
      dir = parent
    }
  }
}

/**
 * 加载项目上下文 (CLAUDE.md + .mimo/ 指令)
 */
export async function loadProjectContext(cwd: string): Promise<ProjectContext> {
  const projectRoot = await findProjectRoot(cwd)

  // 1. 加载项目根目录的 CLAUDE.md
  const rootFiles = await findContextFiles(projectRoot)
  const rootParts: string[] = []
  for (const file of rootFiles) {
    const content = await readFileSafe(file)
    if (content.trim()) rootParts.push(content.trim())
  }
  const rootInstructions = rootParts.join('\n\n')

  // 2. 加载 .mimo/ 目录下的指令
  const mimoDir = path.join(projectRoot, MIMO_DIR)
  const mimoParts: string[] = []
  try {
    const mimoFiles = await findContextFiles(mimoDir)
    for (const file of mimoFiles) {
      const content = await readFileSafe(file)
      if (content.trim()) mimoParts.push(content.trim())
    }
  } catch {
    // .mimo/ 目录不存在
  }
  const mimoInstructions = mimoParts.join('\n\n')

  // 3. 合并
  const fullContext = [rootInstructions, mimoInstructions].filter(Boolean).join('\n\n---\n\n')

  return { rootInstructions, mimoInstructions, fullContext }
}

/**
 * 构建完整的系统 prompt (环境信息 + 项目上下文 + 行为指令)
 */
export function buildSystemPrompt(
  projectContext: string,
  options: { cwd?: string; platform?: string; date?: string } = {}
): string {
  const cwd = options.cwd || process.cwd()
  const platform = options.platform || process.platform
  const date = options.date || new Date().toISOString().split('T')[0]

  let prompt = `You are MiMo CLI, an expert AI coding assistant in the terminal (similar to Claude Code).

Environment:
- Working directory: ${cwd}
- Platform: ${platform}
- Date: ${date}`

  if (projectContext) {
    prompt += `\n\nProject Context:\n${projectContext}`
  }

  prompt += `

You have tools to read, write, and edit files, run shell commands, and search the codebase.

Behavior:
- Be direct and helpful. Prefer action over lengthy explanations.
- Use tools proactively to inspect code before making changes.
- When editing, read the file first unless you already have its contents.
- Prefer small, focused edits over rewriting entire files.
- Show concise summaries of what you did after using tools.
- Use markdown for code snippets and structured answers.
- Ask clarifying questions only when truly blocked.

Safety:
- Do not run destructive commands without explicit user request.
- Do not exfiltrate secrets or credentials.`

  return prompt
}
