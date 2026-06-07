import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, MiMoConfig } from '../../src/config/settings';

describe('Config Settings', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mimo-test-'));
  const testConfigPath = path.join(tmpDir, '.mimo-cli.json');
  let origHome: string | undefined;
  let origUserProfile: string | undefined;

  beforeAll(() => {
    origHome = process.env.HOME;
    origUserProfile = process.env.USERPROFILE;
    // Redirect config path to temp dir
    process.env.HOME = tmpDir;
    delete process.env.USERPROFILE;
  });

  afterAll(() => {
    // Restore env
    if (origHome !== undefined) process.env.HOME = origHome;
    if (origUserProfile !== undefined) process.env.USERPROFILE = origUserProfile;
    // Cleanup
    try {
      if (fs.existsSync(testConfigPath)) fs.unlinkSync(testConfigPath);
      fs.rmdirSync(tmpDir);
    } catch (e) { /* ignore */ }
  });

  it('should load default config when no file exists', () => {
    const config = loadConfig();
    expect(config.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com/v1');
    expect(config.model).toBe('mimo-v2.5-pro');
    expect(config.maxTokens).toBe(4096);
    expect(config.temperature).toBe(0.7);
    expect(config.maxContextTokens).toBe(32000);
    expect(Array.isArray(config.autoApprove)).toBe(true);
  });

  it('should save and load config', () => {
    saveConfig({ apiKey: 'test-key' });
    const config = loadConfig();
    expect(config.apiKey).toBe('test-key');
    expect(config.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com/v1');
  });

  it('should preserve existing config fields on save', () => {
    saveConfig({ model: 'custom-model' });
    const config = loadConfig();
    expect(config.model).toBe('custom-model');
    expect(config.apiKey).toBe('test-key'); // preserved from previous test
  });
});
