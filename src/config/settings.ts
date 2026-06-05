import * as fs from 'fs';
import * as path from 'path';

export interface MiMoConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: MiMoConfig = {
  apiKey: '',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  model: 'mimo-v2.5-pro',
  maxTokens: 4096,
  temperature: 0.7
};

function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(homeDir, '.mimo-cli.json');
}

export function loadConfig(): MiMoConfig {
  const configPath = getConfigPath();
  
  if (fs.existsSync(configPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...saved };
    } catch (error) {
      console.warn('配置文件读取失败，使用默认配置');
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<MiMoConfig>): void {
  const configPath = getConfigPath();
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}
