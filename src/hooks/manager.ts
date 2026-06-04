// Hook 系统 - 工具执行前后的钩子

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export type HookType = 'pre-tool' | 'post-tool' | 'pre-command' | 'post-command'

export interface HookConfig {
  /** 钩子类型 */
  type: HookType
  /** 匹配的工具名称模式 (支持通配符) */
  pattern: string
  /** 要执行的命令 */
  command: string
  /** 是否在后台运行 */
  background?: boolean
  /** 超时时间 (毫秒) */
  timeout?: number
}

export interface HookContext {
  /** 工具名称 */
  toolName: string
  /** 工具输入参数 */
  input: Record<string, any>
  /** 工具输出结果 (仅 post-tool) */
  output?: string
  /** 是否成功 (仅 post-tool) */
  success?: boolean
  /** 工作目录 */
  workingDir: string
}

export interface HookResult {
  /** 是否继续执行 */
  continue: boolean
  /** 修改后的输入 (仅 pre-tool) */
  modifiedInput?: Record<string, any>
  /** 修改后的输出 (仅 post-tool) */
  modifiedOutput?: string
  /** 错误信息 (如果 continue=false) */
  error?: string
}

const DEFAULT_HOOKS_DIR = '.mimo/hooks'

/**
 * 加载钩子配置
 */
export async function loadHooks(workingDir: string = process.cwd()): Promise<HookConfig[]> {
  const hooksDir = path.join(workingDir, DEFAULT_HOOKS_DIR)
  const hooks: HookConfig[] = []
  
  try {
    const files = await fs.readdir(hooksDir)
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      
      try {
        const content = await fs.readFile(path.join(hooksDir, file), 'utf-8')
        const config = JSON.parse(content) as HookConfig | HookConfig[]
        
        if (Array.isArray(config)) {
          hooks.push(...config)
        } else {
          hooks.push(config)
        }
      } catch (error) {
        console.error(`Failed to load hook ${file}:`, error)
      }
    }
  } catch {
    // 目录不存在，返回空数组
  }
  
  return hooks
}

/**
 * 匹配工具名称模式
 */
function matchPattern(pattern: string, toolName: string): boolean {
  // 支持通配符匹配
  const regex = new RegExp(
    '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    'i'
  )
  return regex.test(toolName)
}

/**
 * 执行钩子命令
 */
async function executeHookCommand(
  command: string,
  context: HookContext,
  timeout: number = 5000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // 设置环境变量
  const env = {
    ...process.env,
    MIMO_HOOK_TOOL: context.toolName,
    MIMO_HOOK_INPUT: JSON.stringify(context.input),
    MIMO_HOOK_OUTPUT: context.output || '',
    MIMO_HOOK_SUCCESS: String(context.success ?? true),
    MIMO_HOOK_CWD: context.workingDir,
  }
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      env,
      timeout,
      cwd: context.workingDir,
    })
    
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout?.trim() || '',
      stderr: error.stderr?.trim() || error.message,
      exitCode: error.code || 1,
    }
  }
}

/**
 * 执行 pre-tool 钩子
 */
export async function executePreToolHooks(
  toolName: string,
  input: Record<string, any>,
  hooks: HookConfig[]
): Promise<HookResult> {
  const context: HookContext = {
    toolName,
    input,
    workingDir: process.cwd(),
  }
  
  const matchingHooks = hooks.filter(
    h => h.type === 'pre-tool' && matchPattern(h.pattern, toolName)
  )
  
  for (const hook of matchingHooks) {
    const timeout = hook.timeout || 5000
    const result = await executeHookCommand(hook.command, context, timeout)
    
    if (result.exitCode !== 0) {
      // 钩子失败，阻止执行
      return {
        continue: false,
        error: `Hook failed (${hook.command}): ${result.stderr}`,
      }
    }
    
    // 尝试解析修改后的输入
    if (result.stdout) {
      try {
        const modifiedInput = JSON.parse(result.stdout)
        if (typeof modifiedInput === 'object' && modifiedInput !== null) {
          return {
            continue: true,
            modifiedInput,
          }
        }
      } catch {
        // 输出不是 JSON，忽略
      }
    }
  }
  
  return { continue: true }
}

/**
 * 执行 post-tool 钩子
 */
export async function executePostToolHooks(
  toolName: string,
  input: Record<string, any>,
  output: string,
  success: boolean,
  hooks: HookConfig[]
): Promise<HookResult> {
  const context: HookContext = {
    toolName,
    input,
    output,
    success,
    workingDir: process.cwd(),
  }
  
  const matchingHooks = hooks.filter(
    h => h.type === 'post-tool' && matchPattern(h.pattern, toolName)
  )
  
  for (const hook of matchingHooks) {
    const timeout = hook.timeout || 5000
    
    if (hook.background) {
      // 后台执行，不等待结果
      executeHookCommand(hook.command, context, timeout).catch(() => {})
      continue
    }
    
    const result = await executeHookCommand(hook.command, context, timeout)
    
    if (result.exitCode !== 0) {
      console.error(`Post-hook failed (${hook.command}): ${result.stderr}`)
      // post-hook 失败不阻止执行，只记录错误
    }
    
    // 尝试解析修改后的输出
    if (result.stdout) {
      try {
        const parsed = JSON.parse(result.stdout)
        if (typeof parsed === 'object' && parsed.output) {
          return {
            continue: true,
            modifiedOutput: parsed.output,
          }
        }
      } catch {
        // 输出不是 JSON，忽略
      }
    }
  }
  
  return { continue: true }
}

/**
 * 创建默认钩子配置示例
 */
export function createDefaultHookExample(): string {
  return JSON.stringify({
    type: 'post-tool',
    pattern: 'Write',
    command: 'echo "File written: $MIMO_HOOK_INPUT" >> ~/.mimo/hooks.log',
    background: true,
  }, null, 2)
}
