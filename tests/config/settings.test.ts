import * as fs from 'fs';
import * as path from 'path';
import { loadConfig, saveConfig } from '../../src/config/settings';

describe('Config Settings', () => {
  const testConfigPath = path.join(process.env.USERPROFILE || '.', '.mimo-cli.json');
  let originalConfig: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(testConfigPath)) {
      originalConfig = fs.readFileSync(testConfigPath, 'utf-8');
    }
  });

  afterAll(() => {
    if (originalConfig) {
      fs.writeFileSync(testConfigPath, originalConfig);
    } else if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it('should load default config when no file exists', () => {
    const config = loadConfig();
    expect(config.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com/v1');
    expect(config.model).toBe('mimo-v2.5-pro');
    expect(config.maxTokens).toBe(4096);
    expect(config.temperature).toBe(0.7);
  });

  it('should save and load config', () => {
    saveConfig({ apiKey: 'test-key' });
    const config = loadConfig();
    expect(config.apiKey).toBe('test-key');
    expect(config.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com/v1');
  });
});
