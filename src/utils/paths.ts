import * as path from 'path';
import * as fs from 'fs';

/**
 * 获取用户 home 目录
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '.';
}

/**
 * 获取 MiMo CLI 配置目录 (~/.mimo)
 */
export function getMimoDir(): string {
  return path.join(getHomeDir(), '.mimo');
}

/**
 * 获取 MiMo CLI 配置文件路径 (~/.mimo-cli.json)
 */
export function getConfigPath(): string {
  return path.join(getHomeDir(), '.mimo-cli.json');
}

/**
 * 确保目录存在，不存在则创建
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 确保 MiMo 目录存在
 */
export function ensureMimoDir(): string {
  const dir = getMimoDir();
  ensureDir(dir);
  return dir;
}
