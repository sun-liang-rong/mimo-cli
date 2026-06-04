// 项目上下文加载器 - 自动加载 MIMO.md 项目文件

import fs from 'fs/promises'
import path from 'path'

export interface ProjectContext {
  /** 项目根目录的 MIMO.md 内容 */
  projectMd: string
  /** .mimo/MIMO.local.md 内容 (个人覆盖) */
  localMd: string
  /** 合并后的完整上下文 */
  fullContext: string
  /** 是否找到任何上下文文件 */
  found: boolean
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 安全读取文件，不存在时返回空字符串
 */
async function safeReadFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * 加载项目上下文
 * 优先级: MIMO.md > .mimo/MIMO.local.md > ~/.mimo/CLAUDE.md (全局)
 */
export async function loadProjectContext(
  workingDir: string = process.cwd()
): Promise<ProjectContext> {
  const projectMdPath = path.join(workingDir, 'MIMO.md')
  const localMdPath = path.join(workingDir, '.mimo', 'MIMO.local.md')
  const globalMdPath = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.mimo',
    'CLAUDE.md'
  )

  // 并行读取所有可能的上下文文件
  const [projectMd, localMd, globalMd] = await Promise.all([
    safeReadFile(projectMdPath),
    safeReadFile(localMdPath),
    safeReadFile(globalMdPath),
  ])

  // 合并上下文 (项目 > 本地 > 全局)
  const parts: string[] = []
  
  if (projectMd.trim()) {
    parts.push(`# Project Context (MIMO.md)\n\n${projectMd.trim()}`)
  }
  
  if (localMd.trim()) {
    parts.push(`# Local Overrides (.mimo/MIMO.local.md)\n\n${localMd.trim()}`)
  }
  
  if (globalMd.trim() && !projectMd.trim()) {
    // 只在没有项目级 MIMO.md 时使用全局上下文
    parts.push(`# Global Context (~/.mimo/CLAUDE.md)\n\n${globalMd.trim()}`)
  }

  const fullContext = parts.join('\n\n---\n\n')

  return {
    projectMd,
    localMd,
    fullContext,
    found: parts.length > 0,
  }
}

/**
 * 获取项目上下文摘要 (用于显示)
 */
export function getProjectContextSummary(context: ProjectContext): string {
  const sources: string[] = []
  
  if (context.projectMd.trim()) {
    const lines = context.projectMd.split('\n').filter(l => l.trim())
    const title = lines[0]?.replace(/^#\s*/, '') || 'Untitled'
    sources.push(`MIMO.md: ${title}`)
  }
  
  if (context.localMd.trim()) {
    sources.push('.mimo/MIMO.local.md')
  }
  
  if (sources.length === 0) {
    return 'No project context found'
  }
  
  return `Loaded: ${sources.join(', ')}`
}

/**
 * 生成 MIMO.md 模板
 */
export function generateMimoMdTemplate(projectName?: string): string {
  const name = projectName || path.basename(process.cwd())
  
  return `# ${name}

## 项目概述
[简要描述项目的目的和功能]

## 技术栈
- 框架: 
- 语言: 
- 数据库: 
- 测试: 

## 常用命令
\`\`\`bash
# 开发
npm run dev

# 测试
npm test

# 构建
npm run build

# 部署
npm run deploy
\`\`\`

## 代码规范
- 缩进: 2 空格
- 命名: camelCase (变量/函数), PascalCase (类/组件)
- 注释: 中文注释，JSDoc 格式

## 项目结构
\`\`\`
src/
├── components/    # UI 组件
├── services/      # 业务逻辑
├── utils/         # 工具函数
└── types/         # 类型定义
\`\`\`

## 注意事项
- [列出项目的重要注意事项]
`
}
