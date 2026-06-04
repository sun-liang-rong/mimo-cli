// Git Worktree 管理 - 隔离工作目录

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface WorktreeInfo {
  /** 工作树路径 */
  path: string
  /** 分支名 */
  branch: string
  /** HEAD commit */
  head: string
  /** 是否是主工作树 */
  isMain: boolean
  /** 是否是当前工作树 */
  isCurrent: boolean
}

export interface CreateWorktreeOptions {
  /** 分支名 */
  branch: string
  /** 工作树路径 (可选，默认在 .claude/worktrees/ 下) */
  path?: string
  /** 是否创建新分支 */
  createBranch?: boolean
  /** 基于哪个 commit/branch 创建 */
  from?: string
}

/**
 * Git Worktree 管理器
 */
export class GitWorktreeManager {
  private repoPath: string

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath
  }

  /**
   * 检查是否在 Git 仓库中
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir', { cwd: this.repoPath })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取所有工作树
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: this.repoPath,
      })

      const worktrees: WorktreeInfo[] = []
      let current: Partial<WorktreeInfo> = {}

      for (const line of stdout.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) {
            worktrees.push(current as WorktreeInfo)
          }
          current = {
            path: line.slice(9),
            isMain: false,
            isCurrent: false,
          }
        } else if (line.startsWith('HEAD ')) {
          current.head = line.slice(5)
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice(7).replace('refs/heads/', '')
        } else if (line === 'bare') {
          current.isMain = true
        } else if (line === '') {
          if (current.path) {
            // 检查是否是当前目录
            current.isCurrent = current.path === this.repoPath
            worktrees.push(current as WorktreeInfo)
            current = {}
          }
        }
      }

      if (current.path) {
        current.isCurrent = current.path === this.repoPath
        worktrees.push(current as WorktreeInfo)
      }

      // 标记主工作树
      if (worktrees.length > 0) {
        worktrees[0].isMain = true
      }

      return worktrees
    } catch (error: any) {
      throw new Error(`Failed to list worktrees: ${error.message}`)
    }
  }

  /**
   * 创建新工作树
   */
  async createWorktree(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
    const isRepo = await this.isGitRepo()
    if (!isRepo) {
      throw new Error('Not in a Git repository')
    }

    // 默认路径
    const worktreePath = options.path || 
      path.join(this.repoPath, '.claude', 'worktrees', options.branch)

    // 确保目录不存在
    try {
      await fs.access(worktreePath)
      throw new Error(`Worktree path already exists: ${worktreePath}`)
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error
      }
    }

    // 创建父目录
    await fs.mkdir(path.dirname(worktreePath), { recursive: true })

    // 构建命令
    let cmd = `git worktree add`
    if (options.createBranch) {
      cmd += ` -b ${options.branch}`
    }
    cmd += ` ${worktreePath}`
    if (options.from && !options.createBranch) {
      cmd += ` ${options.from}`
    }

    try {
      await execAsync(cmd, { cwd: this.repoPath })

      return {
        path: worktreePath,
        branch: options.branch,
        head: '',
        isMain: false,
        isCurrent: false,
      }
    } catch (error: any) {
      throw new Error(`Failed to create worktree: ${error.message}`)
    }
  }

  /**
   * 删除工作树
   */
  async removeWorktree(worktreePath: string, force: boolean = false): Promise<void> {
    const cmd = `git worktree remove${force ? ' --force' : ''} ${worktreePath}`
    
    try {
      await execAsync(cmd, { cwd: this.repoPath })
    } catch (error: any) {
      throw new Error(`Failed to remove worktree: ${error.message}`)
    }
  }

  /**
   * 清理无效的工作树引用
   */
  async pruneWorktrees(): Promise<string> {
    try {
      const { stdout } = await execAsync('git worktree prune', {
        cwd: this.repoPath,
      })
      return stdout.trim() || 'No worktrees pruned'
    } catch (error: any) {
      throw new Error(`Failed to prune worktrees: ${error.message}`)
    }
  }

  /**
   * 在工作树中执行命令
   */
  async execInWorktree(worktreePath: string, command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: worktreePath,
      })
      return stdout || stderr
    } catch (error: any) {
      throw new Error(`Command failed in worktree: ${error.message}`)
    }
  }

  /**
   * 获取工作树状态
   */
  async getWorktreeStatus(worktreePath: string): Promise<{
    branch: string
    modified: number
    staged: number
    untracked: number
  }> {
    try {
      const { stdout: branch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: worktreePath }
      )

      const { stdout: status } = await execAsync(
        'git status --porcelain',
        { cwd: worktreePath }
      )

      const lines = status.split('\n').filter(l => l.trim())
      let modified = 0
      let staged = 0
      let untracked = 0

      for (const line of lines) {
        if (line.startsWith('??')) {
          untracked++
        } else if (line[0] !== ' ' && line[0] !== '?') {
          staged++
        } else if (line[1] !== ' ') {
          modified++
        }
      }

      return {
        branch: branch.trim(),
        modified,
        staged,
        untracked,
      }
    } catch (error: any) {
      throw new Error(`Failed to get worktree status: ${error.message}`)
    }
  }
}

/**
 * 格式化工作树列表为可读文本
 */
export function formatWorktreeList(worktrees: WorktreeInfo[]): string {
  if (worktrees.length === 0) {
    return 'No worktrees found.'
  }

  const lines = [
    '🌿 Git Worktrees',
    '─'.repeat(60),
    '',
  ]

  for (const wt of worktrees) {
    const marker = wt.isCurrent ? '→ ' : '  '
    const mainTag = wt.isMain ? ' (main)' : ''
    const branch = wt.branch || '(detached)'
    
    lines.push(`${marker}${branch}${mainTag}`)
    lines.push(`   Path: ${wt.path}`)
    if (wt.head) {
      lines.push(`   HEAD: ${wt.head.slice(0, 8)}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
