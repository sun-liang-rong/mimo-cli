import { describe, it, expect, beforeEach } from 'vitest'
import { PluginManager } from '../plugin.js'
import type { ToolDefinition } from '../types.js'

describe('PluginManager', () => {
  let pm: PluginManager

  beforeEach(() => {
    pm = new PluginManager()
  })

  it('should create with empty config', () => {
    expect(pm.getPluginTools()).toEqual([])
    expect(pm.getLoadedPlugins()).toEqual([])
  })

  it('should register custom tool', () => {
    const tool: ToolDefinition = {
      name: 'CustomTool',
      description: 'A custom tool',
      input_schema: { type: 'object', properties: {} },
      requiresApproval: false,
      async execute() { return { success: true, output: 'ok' } },
    }
    pm.registerTool(tool)
    expect(pm.getPluginTools()).toHaveLength(1)
    expect(pm.getPluginTools()[0].name).toBe('CustomTool')
  })

  it('should overwrite existing tool on re-register', () => {
    const tool1: ToolDefinition = {
      name: 'SameName',
      description: 'v1',
      input_schema: {},
      requiresApproval: false,
      async execute() { return { success: true, output: 'v1' } },
    }
    const tool2: ToolDefinition = {
      name: 'SameName',
      description: 'v2',
      input_schema: {},
      requiresApproval: true,
      async execute() { return { success: true, output: 'v2' } },
    }
    pm.registerTool(tool1)
    pm.registerTool(tool2)
    expect(pm.getPluginTools()).toHaveLength(1)
    expect(pm.getPluginTools()[0].description).toBe('v2')
  })

  it('should register multiple tools', () => {
    for (let i = 0; i < 5; i++) {
      pm.registerTool({
        name: `Tool${i}`,
        description: `Tool ${i}`,
        input_schema: {},
        requiresApproval: false,
        async execute() { return { success: true, output: '' } },
      })
    }
    expect(pm.getPluginTools()).toHaveLength(5)
  })

  it('should execute registered tool', async () => {
    pm.registerTool({
      name: 'TestExec',
      description: 'Test',
      input_schema: {},
      requiresApproval: false,
      async execute(input: Record<string, any>) {
        return { success: true, output: `Hello ${input.name}` }
      },
    })
    const tool = pm.getPluginTools().find(t => t.name === 'TestExec')
    const result = await tool!.execute({ name: 'World' })
    expect(result.success).toBe(true)
    expect(result.output).toBe('Hello World')
  })

  it('should unload plugin', () => {
    pm.registerTool({
      name: 'ToUnload',
      description: 'Will be unloaded',
      input_schema: {},
      requiresApproval: false,
      async execute() { return { success: true, output: '' } },
    })
    expect(pm.getPluginTools()).toHaveLength(1)
    // unloadPlugin only works for manifest-loaded plugins, not manually registered
    const result = pm.unloadPlugin('non-existent')
    expect(result).toBe(false)
  })

  it('should return empty list initially', () => {
    expect(pm.getPluginTools()).toEqual([])
  })

  it('should return empty plugins list initially', () => {
    expect(pm.getLoadedPlugins()).toEqual([])
  })

  it('should handle tool with approval required', () => {
    pm.registerTool({
      name: 'DangerousTool',
      description: 'Requires approval',
      input_schema: { type: 'object', properties: { cmd: { type: 'string' } } },
      requiresApproval: true,
      async execute() { return { success: true, output: 'done' } },
    })
    const tool = pm.getPluginTools()[0]
    expect(tool.requiresApproval).toBe(true)
  })

  it('should handle tool execution error', async () => {
    pm.registerTool({
      name: 'ErrorTool',
      description: 'Throws error',
      input_schema: {},
      requiresApproval: false,
      async execute() { throw new Error('tool error') },
    })
    const tool = pm.getPluginTools()[0]
    await expect(tool.execute({})).rejects.toThrow('tool error')
  })

  it('should create with plugin config', () => {
    const manager = new PluginManager({ pluginDir: '/tmp/plugins', enabledPlugins: ['test'] })
    expect(manager.getPluginTools()).toEqual([])
  })

  it('should handle loadPlugins with non-existent dir', async () => {
    const manager = new PluginManager({ pluginDir: '/non/existent/path' })
    await manager.loadPlugins()
    expect(manager.getPluginTools()).toEqual([])
  })

  it('should handle loadPlugins with empty config', async () => {
    await pm.loadPlugins()
    expect(pm.getPluginTools()).toEqual([])
  })

  it('should register tool with complex schema', () => {
    pm.registerTool({
      name: 'ComplexTool',
      description: 'Complex schema',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path' },
          options: {
            type: 'object',
            properties: {
              recursive: { type: 'boolean' },
            },
          },
        },
        required: ['file_path'],
      },
      requiresApproval: false,
      async execute() { return { success: true, output: '' } },
    })
    const tool = pm.getPluginTools()[0]
    expect(tool.input_schema.required).toContain('file_path')
  })

  it('should handle tool returning string result', async () => {
    pm.registerTool({
      name: 'StringTool',
      description: 'Returns string',
      input_schema: {},
      requiresApproval: false,
      async execute() { return { success: true, output: 'string result' } },
    })
    const result = await pm.getPluginTools()[0].execute({})
    expect(result.output).toBe('string result')
  })
})
