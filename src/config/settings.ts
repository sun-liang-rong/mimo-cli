import * as fs from 'fs';
import * as path from 'path';
import { getHomeDir, getMimoDir, ensureDir } from '../utils/paths.js';

export type ApproveMode = 'smart' | 'auto' | 'confirm-all';
export type CompactMode = 'auto' | 'manual' | 'aggressive';

export interface MiMoConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  maxContextTokens: number;
  autoApprove: string[];
  historyPath: string;
  approveMode: ApproveMode;
  compactMode: CompactMode;
  budgetPerSession: number;
  budgetMode: 'unlimited' | 'soft_limit' | 'hard_limit';
}

/** Model-specific context window sizes (input tokens) */
const MODEL_CONTEXT_MAP: Record<string, number> = {
  // MiMo models
  'mimo-v2.5-pro': 1000000,
  'mimo-v2.5': 1000000,
  'mimo-v2': 16000,

  // GPT-4o series
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4o-2024-05-13': 128000,
  'gpt-4o-2024-08-06': 128000,
  'gpt-4o-2024-11-20': 128000,

  // GPT-4.1 series
  'gpt-4.1': 128000,
  'gpt-4.1-mini': 128000,
  'gpt-4.1-nano': 128000,

  // GPT-4 series
  'gpt-4-turbo': 128000,
  'gpt-4-turbo-preview': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,

  // GPT-3.5 series
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,

  // Claude 3 series
  'claude-3.5-sonnet': 200000,
  'claude-3.5-sonnet-20241022': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,

  // Claude 4 series
  'claude-opus-4-8': 200000,
  'claude-sonnet-4-6': 200000,
  'claude-haiku-4-5-20251001': 200000,

  // DeepSeek series
  'deepseek-chat': 64000,
  'deepseek-coder': 64000,
  'deepseek-reasoner': 64000,

  // Qwen series
  'qwen-max': 32000,
  'qwen-plus': 32000,
  'qwen-turbo': 8000,
  'qwen-coder-plus': 32000,

  // Other popular models
  'gemini-1.5-pro': 128000,
  'gemini-1.5-flash': 128000,
  'llama-3-70b': 8192,
  'llama-3-8b': 8192,
};

/** Context size tiers for heuristic matching */
const CONTEXT_TIERS = [
  { patterns: [/128k/i, /gpt-4o/i, /gemini-1\.5/i, /gpt-4\.1/i], size: 128000 },
  { patterns: [/200k/i, /claude/i, /opus/i, /sonnet/i], size: 200000 },
  { patterns: [/64k/i, /deepseek/i], size: 64000 },
  { patterns: [/32k/i, /qwen-max/i, /qwen-plus/i, /gpt-4-32k/i], size: 32000 },
  { patterns: [/16k/i, /3\.5-turbo/i, /mimo-v2(?!\.5)/i], size: 16000 },
  { patterns: [/8k/i, /gpt-4[^-]/i, /llama-3/i], size: 8192 },
];

/** Get context window size for a model, with fallback heuristic */
export function getModelContextSize(model: string): number {
  if (!model || typeof model !== 'string') {
    return 32000; // Default for invalid input
  }

  const normalizedModel = model.toLowerCase().trim();

  // Exact match
  if (MODEL_CONTEXT_MAP[normalizedModel]) {
    return MODEL_CONTEXT_MAP[normalizedModel];
  }

  // Prefix match (handles model variations like gpt-4o-2024-05-13)
  for (const [key, value] of Object.entries(MODEL_CONTEXT_MAP)) {
    if (normalizedModel.startsWith(key)) return value;
  }

  // Heuristic: check against tier patterns
  for (const tier of CONTEXT_TIERS) {
    for (const pattern of tier.patterns) {
      if (pattern.test(normalizedModel)) return tier.size;
    }
  }

  // Default: 32k
  return 32000;
}

/** Validate that context size is within reasonable bounds */
export function validateContextSize(size: number): number {
  const MIN_CONTEXT = 1024;
  const MAX_CONTEXT = 1000000;
  if (!size || size < MIN_CONTEXT) return MIN_CONTEXT;
  if (size > MAX_CONTEXT) return MAX_CONTEXT;
  return size;
}

const DEFAULT_CONFIG: MiMoConfig = {
  apiKey: '',
  baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
  model: 'mimo-v2.5-pro',
  maxTokens: 4096,
  temperature: 0.7,
  maxContextTokens: 0,  // 0 = auto-detect from model
  autoApprove: [],
  historyPath: '',
  approveMode: 'smart',
  compactMode: 'auto',
  budgetPerSession: 0,
  budgetMode: 'unlimited',
};

function getConfigPath(): string {
  return path.join(getHomeDir(), '.mimo-cli.json');
}

export { getMimoDir } from '../utils/paths.js';

export function loadConfig(): MiMoConfig {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...saved };
    } catch {
      return DEFAULT_CONFIG;
    }
  }
  return DEFAULT_CONFIG;
}

/** Load config and resolve maxContextTokens from model if set to 0 (auto) */
export function loadResolvedConfig(): MiMoConfig {
  const config = loadConfig();
  if (config.maxContextTokens === 0) {
    config.maxContextTokens = validateContextSize(getModelContextSize(config.model));
  }
  return config;
}

export function saveConfig(config: Partial<MiMoConfig>): void {
  const configPath = getConfigPath();
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}

export function getMimoHome(): string {
  const dir = getMimoDir();
  ensureDir(dir);
  return dir;
}
