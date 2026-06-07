import { MiMoClient } from '../../src/ai/client';

jest.mock('../../src/config/settings', () => ({
  loadConfig: () => ({
    apiKey: 'test-key',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    maxTokens: 4096,
    temperature: 0.7,
    maxContextTokens: 32000,
    autoApprove: [],
    historyPath: '',
  })
}));

describe('MiMoClient', () => {
  it('should create client instance', () => {
    const client = new MiMoClient();
    expect(client).toBeDefined();
  });

  it('should throw error when API key is missing', () => {
    jest.resetModules();
    jest.mock('../../src/config/settings', () => ({
      loadConfig: () => ({
        apiKey: '',
        baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
        model: 'mimo-v2.5-pro',
        maxTokens: 4096,
        temperature: 0.7,
        maxContextTokens: 32000,
        autoApprove: [],
        historyPath: '',
      })
    }));
    const { MiMoClient: MiMoClient2 } = require('../../src/ai/client');
    expect(() => new MiMoClient2()).toThrow();
  });
});
