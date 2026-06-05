import simpleGit, { SimpleGit } from 'simple-git';
import { ToolDefinition, ToolHandler, ToolResult } from './types';
import { ToolRegistry } from './registry';

export const gitStatusTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_status',
    description: '获取 Git 仓库状态',
    parameters: {
      type: 'object',
      description: 'Git 状态查询参数',
      properties: {
        path: {
          type: 'string',
          description: '仓库路径，默认为当前目录'
        }
      }
    }
  }
};

export const gitStatusHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git: SimpleGit = simpleGit(args.path || '.');
    const status = await git.status();
    
    let output = `分支: ${status.current}\n`;
    output += `状态: ${status.ahead > 0 ? `领先 ${status.ahead} 个提交` : ''}${status.behind > 0 ? ` 落后 ${status.behind} 个提交` : ''}\n`;
    
    if (status.modified.length > 0) {
      output += `\n修改的文件:\n${status.modified.map(f => `  ${f}`).join('\n')}`;
    }
    if (status.not_added.length > 0) {
      output += `\n未跟踪的文件:\n${status.not_added.map(f => `  ${f}`).join('\n')}`;
    }
    if (status.staged.length > 0) {
      output += `\n已暂存的文件:\n${status.staged.map(f => `  ${f}`).join('\n')}`;
    }
    
    return {
      success: true,
      output
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Git 操作失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const gitCommitTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_commit',
    description: '创建 Git 提交',
    parameters: {
      type: 'object',
      description: 'Git 提交参数',
      properties: {
        message: {
          type: 'string',
          description: '提交信息'
        },
        files: {
          type: 'array',
          items: { type: 'string', description: '文件路径' },
          description: '要提交的文件列表，默认提交所有更改'
        },
        path: {
          type: 'string',
          description: '仓库路径，默认为当前目录'
        }
      },
      required: ['message']
    }
  }
};

export const gitCommitHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git: SimpleGit = simpleGit(args.path || '.');
    
    if (args.files && args.files.length > 0) {
      await git.add(args.files);
    } else {
      await git.add('.');
    }
    
    const result = await git.commit(args.message);
    
    return {
      success: true,
      output: `提交成功: ${result.commit}\n${result.summary.changes} 个文件更改，${result.summary.insertions} 行插入，${result.summary.deletions} 行删除`
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Git 提交失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const gitDiffTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_diff',
    description: '查看 Git 差异',
    parameters: {
      type: 'object',
      description: 'Git 差异查询参数',
      properties: {
        file: {
          type: 'string',
          description: '特定文件的差异'
        },
        staged: {
          type: 'boolean',
          description: '查看已暂存的差异'
        },
        path: {
          type: 'string',
          description: '仓库路径，默认为当前目录'
        }
      }
    }
  }
};

export const gitDiffHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git: SimpleGit = simpleGit(args.path || '.');
    
    let diff: string;
    if (args.staged) {
      diff = await git.diff(['--cached']);
    } else if (args.file) {
      diff = await git.diff([args.file]);
    } else {
      diff = await git.diff();
    }
    
    return {
      success: true,
      output: diff || '没有差异'
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Git diff 失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export function registerGitTools(registry: ToolRegistry): void {
  registry.register(gitStatusTool, gitStatusHandler);
  registry.register(gitCommitTool, gitCommitHandler);
  registry.register(gitDiffTool, gitDiffHandler);
}