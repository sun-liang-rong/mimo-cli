import { describe, it, expect, beforeEach } from 'vitest'
import { ModelManager } from '../models.js'

describe('ModelManager', () => {
  let mm: ModelManager

  beforeEach(() => {
    mm = new ModelManager()
  })

  it('should create with default model', () => {
    const model = mm.getCurrentModel()
    expect(model.id).toBe('MiMo-7B-RL')
  })

  it('should create with custom models', () => {
    const manager = new ModelManager({
      models: [
        { id: 'custom', name: 'Custom', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 1, enabled: true },
      ],
      defaultModel: 'custom',
    })
    expect(manager.getCurrentModel().id).toBe('custom')
  })

  it('should switch model', () => {
    mm.addModel({ id: 'other', name: 'Other', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    expect(mm.switchModel('other')).toBe(true)
    expect(mm.getCurrentModel().id).toBe('other')
  })

  it('should fail to switch to non-existent model', () => {
    expect(mm.switchModel('non-existent')).toBe(false)
  })

  it('should get MiMoConfig', () => {
    const config = mm.getMiMoConfig('test-key')
    expect(config.apiKey).toBe('test-key')
    expect(config.model).toBe('MiMo-7B-RL')
  })

  it('should get fallback chain', () => {
    mm.addModel({ id: 'fallback', name: 'Fallback', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    const chain = mm.getFallbackChain()
    expect(chain.length).toBe(1)
    expect(chain[0].id).toBe('fallback')
  })

  it('should return only current model when fallback disabled', () => {
    const manager = new ModelManager({ fallbackEnabled: false })
    manager.addModel({ id: 'other', name: 'Other', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    const chain = manager.getFallbackChain()
    expect(chain.length).toBe(1)
  })

  it('should add model', () => {
    mm.addModel({ id: 'new', name: 'New', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    expect(mm.listModels().length).toBe(2)
  })

  it('should remove model', () => {
    mm.addModel({ id: 'to-remove', name: 'Remove', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    expect(mm.removeModel('to-remove')).toBe(true)
    expect(mm.listModels().length).toBe(1)
  })

  it('should not remove current model', () => {
    expect(mm.removeModel('MiMo-7B-RL')).toBe(false)
  })

  it('should list all models', () => {
    const models = mm.listModels()
    expect(models.length).toBe(1)
    expect(models[0].id).toBe('MiMo-7B-RL')
  })

  it('should enable/disable model', () => {
    mm.addModel({ id: 'toggle', name: 'Toggle', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 2, enabled: true })
    expect(mm.setModelEnabled('toggle', false)).toBe(true)
    const model = mm.listModels().find(m => m.id === 'toggle')
    expect(model!.enabled).toBe(false)
  })

  it('should fail to enable non-existent model', () => {
    expect(mm.setModelEnabled('non-existent', true)).toBe(false)
  })

  it('should filter disabled models from fallback', () => {
    mm.addModel({ id: 'disabled', name: 'Disabled', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 1, enabled: false })
    const chain = mm.getFallbackChain()
    expect(chain.find(m => m.id === 'disabled')).toBeUndefined()
  })

  it('should sort fallback by priority', () => {
    mm.addModel({ id: 'low', name: 'Low', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 10, enabled: true })
    mm.addModel({ id: 'high', name: 'High', baseURL: 'http://test', maxTokens: 2048, temperature: 0.5, priority: 1, enabled: true })
    const chain = mm.getFallbackChain()
    expect(chain[0].id).toBe('high')
  })

  it('should get MiMoConfig with correct baseURL', () => {
    const config = mm.getMiMoConfig('key')
    expect(config.baseURL).toBe('https://api.xiaomimimo.com/v1')
  })

  it('should get MiMoConfig with correct maxTokens', () => {
    const config = mm.getMiMoConfig('key')
    expect(config.maxTokens).toBe(4096)
  })

  it('should get MiMoConfig with correct temperature', () => {
    const config = mm.getMiMoConfig('key')
    expect(config.temperature).toBe(0.7)
  })

  it('should handle empty models array', () => {
    const manager = new ModelManager({ models: [] })
    // Should fallback to default
    expect(manager.getCurrentModel()).toBeDefined()
  })
})
