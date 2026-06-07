import { ToolDefinition, ToolHandler, ToolResult } from './types.js';
import { ToolRegistry } from './registry.js';
import { MemoryManager } from '../ai/memory.js';
import { CodeGraphBuilder } from '../ai/codegraph.js';
import { getRulesContext, getDependencyInfo } from '../context/rules.js';

export function registerSystemTools(registry: ToolRegistry, memory: MemoryManager, codeGraph: CodeGraphBuilder): void {
  // save_memory
  const saveMemoryTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'save_memory',
      description: '保存关键信息到记忆系统，跨会话保留。用于存储项目约定、技术决策、常见模式等。',
      parameters: {
        type: 'object', description: '记忆参数',
        properties: {
          key: { type: 'string', description: '记忆键名（如 "convention:naming"）' },
          value: { type: 'string', description: '记忆内容' },
          scope: { type: 'string', description: '范围: project（跨会话保留）/ session（当前会话）/ working（短期）' }
        },
        required: ['key', 'value']
      }
    }
  };

  const saveMemoryHandler: ToolHandler = async (args): Promise<ToolResult> => {
    const scope = (args.scope as string) || 'session';
    if (!['project', 'session', 'working'].includes(scope)) {
      return { success: false, output: '', error: 'scope 必须是 project/session/working' };
    }
    memory.set(args.key as string, args.value as string, scope as 'project' | 'session' | 'working');
    return { success: true, output: `已保存记忆: ${args.key} [${scope}]` };
  };

  // query_graph
  const queryGraphTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'query_graph',
      description: '查询代码依赖图谱。了解文件之间的导入/导出关系、谁依赖谁。',
      parameters: {
        type: 'object', description: '查询参数',
        properties: {
          query: { type: 'string', description: '查询类型: dependents（谁依赖此文件）/ imports（此文件依赖谁）/ exports（导出了什么）' },
          file: { type: 'string', description: '目标文件路径' }
      },
        required: ['query']
      }
    }
  };

  const queryGraphHandler: ToolHandler = async (args): Promise<ToolResult> => {
    const query = args.query as string;
    switch (query) {
      case 'dependents': {
        if (!args.file) return { success: false, output: '', error: '需要 file 参数' };
        const deps = codeGraph.getDependents(args.file as string);
        return { success: true, output: deps.length > 0 ? deps.join('\n') : '无依赖此文件的文件' };
      }
      case 'imports': {
        if (!args.file) return { success: false, output: '', error: '需要 file 参数' };
        const imports = codeGraph.getImports(args.file as string);
        return { success: true, output: imports.length > 0 ? imports.join('\n') : '无导入' };
      }
      case 'exports': {
        const ctx = codeGraph.getContextString(2000);
        return { success: true, output: ctx || '图谱为空' };
      }
      default: return { success: false, output: '', error: `未知查询: ${query}` };
    }
  };

  // get_context
  const getContextTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'get_context',
      description: '获取项目上下文信息：规则文件、依赖信息、代码图谱。按需加载，避免预注入过多信息。',
      parameters: {
        type: 'object', description: '参数',
        properties: {
          type: { type: 'string', description: '类型: rules（规则文件）/ deps（依赖）/ graph（代码图谱）/ all（全部）' }
        },
        required: ['type']
      }
    }
  };

  const getContextHandler: ToolHandler = async (args): Promise<ToolResult> => {
    const type = (args.type as string) || 'all';
    let output = '';

    if (type === 'rules' || type === 'all') {
      const rulesCtx = getRulesContext();
      if (rulesCtx) output += rulesCtx + '\n\n';
    }
    if (type === 'deps' || type === 'all') {
      const depsInfo = getDependencyInfo();
      if (depsInfo) output += depsInfo + '\n\n';
    }
    if (type === 'graph' || type === 'all') {
      const graphCtx = codeGraph.getContextString();
      if (graphCtx) output += graphCtx + '\n';
    }

    return { success: true, output: output || '无可用上下文' };
  };

  // spawn_subtask
  const spawnSubtaskTool: ToolDefinition = {
    type: 'function',
    function: {
      name: 'spawn_subtask',
      description: '创建子任务代理处理独立子任务。子任务在独立上下文中执行，完成后结果回传。',
      parameters: {
        type: 'object', description: '参数',
        properties: {
          description: { type: 'string', description: '子任务描述' },
          files: { type: 'array', items: { type: 'string', description: '文件路径' }, description: '子任务涉及的文件范围' }
        },
        required: ['description', 'files']
      }
    }
  };

  const spawnSubtaskHandler: ToolHandler = async (args): Promise<ToolResult> => {
    return { success: true, output: `子任务已创建: ${args.description as string}` };
  };

  registry.register(saveMemoryTool, saveMemoryHandler, { readOnly: false, cost: 'low', maxOutputLength: 500 });
  registry.register(queryGraphTool, queryGraphHandler, { readOnly: true, cost: 'low', maxOutputLength: 5000 });
  registry.register(getContextTool, getContextHandler, { readOnly: true, cost: 'low', maxOutputLength: 8000 });
  registry.register(spawnSubtaskTool, spawnSubtaskHandler, { readOnly: false, cost: 'high', maxOutputLength: 5000 });
}
