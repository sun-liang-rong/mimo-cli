// 配置存储 - 管理用户配置的加载和保存

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Config {
  apiKey: string
  baseURL: string
  model: string
}

const CONFIG_DIR = path.join(os.homedir(), '.mimo')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG: Config = {
  apiKey: '',
  baseURL: 'https://api.xiaomimimo.com/v1',
  model: 'MiMo-7B-RL',
}

/**
 * 加载配置（文件 > 环境变量 > 默认值）
 */
export async function loadConfig(): Promise<Config> {
  // 1. 先读文件配置
  let fileConfig: Partial<Config> = {}
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8')
    fileConfig = JSON.parse(raw)
  } catch {
    // 文件不存在或解析失败，忽略
  }

  // 2. 环境变量覆盖
  const config: Config = {
    apiKey: process.env.MIMO_API_KEY || fileConfig.apiKey || DEFAULT_CONFIG.apiKey,
    baseURL: process.env.MIMO_BASE_URL || fileConfig.baseURL || DEFAULT_CONFIG.baseURL,
    model: process.env.MIMO_MODEL || fileConfig.model || DEFAULT_CONFIG.model,
  }

  return config
}

/**
 * 保存配置到文件
 */
export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 检查配置是否完整
 */
export function isConfigComplete(config: Config): boolean {
  return !!(config.apiKey && config.baseURL && config.model)
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return CONFIG_FILE
}
