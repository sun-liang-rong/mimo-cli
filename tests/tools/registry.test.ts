import { ToolRegistry } from '../../src/tools/registry';
import { ToolDefinition, ToolHandler } from '../../src/tools/types';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('should register and execute tool', async () => {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'test_tool',
        description: '测试工具',
        parameters: {
          type: 'object',
          description: '测试工具参数',
          properties: {
            input: { type: 'string', description: '输入' }
          },
          required: ['input']
        }
      }
    };

    const handler: ToolHandler = async (args) => ({
      success: true,
      output: `收到: ${args.input}`
    });

    registry.register(definition, handler);

    expect(registry.has('test_tool')).toBe(true);
    expect(registry.getDefinitions()).toHaveLength(1);

    const result = await registry.execute('test_tool', { input: 'hello' });
    expect(result.success).toBe(true);
    expect(result.output).toBe('收到: hello');
  });

  it('should handle non-existent tool', async () => {
    const result = await registry.execute('non_existent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('工具未找到');
  });

  it('should handle tool execution error', async () => {
    const definition: ToolDefinition = {
      type: 'function',
      function: {
        name: 'error_tool',
        description: '错误工具',
        parameters: { type: 'object', description: '错误工具参数', properties: {} }
      }
    };

    const handler: ToolHandler = async () => {
      throw new Error('测试错误');
    };

    registry.register(definition, handler);

    const result = await registry.execute('error_tool', {});
    expect(result.success).toBe(false);
    expect(result.error).toBe('测试错误');
  });
});