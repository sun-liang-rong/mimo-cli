import Conf from 'conf';

export type ThinkingMode = 'think' | 'nothink' | 'auto';
export type PermissionMode = 'default' | 'yolo' | 'plan';

export interface MiMoConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxContextTokens: number;
  thinkingMode: ThinkingMode;
  permissionMode: PermissionMode;
}

const DEFAULTS: MiMoConfig = {
  apiKey: '',
  baseUrl: 'https://api.mimo.xiaomi.com/v1',
  model: 'mimo-v2.5-pro',
  temperature: 0.7,
  maxTokens: 4096,
  maxContextTokens: 32000,
  thinkingMode: 'think',
  permissionMode: 'default',
};

const config = new Conf<MiMoConfig>({
  projectName: 'mimo-cli',
  defaults: DEFAULTS,
});

export function getConfig(): MiMoConfig {
  return config.store;
}

export function get<K extends keyof MiMoConfig>(key: K): MiMoConfig[K] {
  return config.get(key);
}

export function set<K extends keyof MiMoConfig>(key: K, value: MiMoConfig[K]): void {
  config.set(key, value);
}

export function resetConfig(): void {
  config.clear();
}

export function showConfig(): Record<string, unknown> {
  const cfg = config.store;
  const masked = { ...cfg };
  if (masked.apiKey && masked.apiKey.length > 8) {
    masked.apiKey = masked.apiKey.slice(0, 4) + '****' + masked.apiKey.slice(-4);
  }
  return masked;
}

export function isConfigured(): boolean {
  return !!config.get('apiKey');
}

export { DEFAULTS };
