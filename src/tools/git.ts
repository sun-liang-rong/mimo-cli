import { simpleGit, SimpleGit } from 'simple-git';
import { ToolDefinition, ToolHandler, ToolResult } from './types.js';
import { ToolRegistry } from './registry.js';
import { getErrorMessage } from '../utils/errors.js';

function getGit(cwd?: string): SimpleGit {
  return simpleGit(cwd || '.');
}

export const gitStatusTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_status',
    description: '查看 Git 仓库当前状态（分支、修改、未跟踪文件等）',
    parameters: { type: 'object', description: '参数', properties: { path: { type: 'string', description: '仓库路径' } }, required: [] }
  }
};

export const gitStatusHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string);
    const status = await git.status();
    let output = `分支: ${status.current}\n`;
    if (status.ahead > 0 || status.behind > 0) {
      output += `${status.ahead > 0 ? `领先 ${status.ahead} 提交` : ''}${status.behind > 0 ? ` 落后 ${status.behind} 提交` : ''}\n`;
    }
    if (status.staged.length > 0) output += `\n已暂存:\n${status.staged.map(f => `  + ${f}`).join('\n')}`;
    if (status.modified.length > 0) output += `\n已修改:\n${status.modified.map(f => `  M ${f}`).join('\n')}`;
    if (status.not_added.length > 0) output += `\n未跟踪:\n${status.not_added.slice(0, 20).map(f => `  ? ${f}`).join('\n')}`;
    if (status.deleted.length > 0) output += `\n已删除:\n${status.deleted.map(f => `  D ${f}`).join('\n')}`;
    if (status.conflicted.length > 0) output += `\n冲突:\n${status.conflicted.map(f => `  C ${f}`).join('\n')}`;
    return { success: true, output };
  } catch (error) {
    return { success: false, output: '', error: `Git 操作失败: ${getErrorMessage(error)}` };
  }
};

export const gitDiffTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_diff',
    description: '查看 Git 差异。可查看工作区、暂存区或指定文件的差异。',
    parameters: { type: 'object', description: '参数', properties: { file: { type: 'string', description: '指定文件' }, staged: { type: 'boolean', description: '查看已暂存的差异' }, path: { type: 'string', description: '仓库路径' } }, required: [] }
  }
};

export const gitDiffHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string);
    let diff: string;
    if (args.staged) diff = await git.diff(['--cached']);
    else if (args.file) diff = await git.diff([args.file as string]);
    else diff = await git.diff();
    if (!diff) return { success: true, output: '没有差异' };
    if (diff.length > 12000) diff = diff.slice(0, 12000) + '\n... (差异过长，已截断)';
    return { success: true, output: diff };
  } catch (error) {
    return { success: false, output: '', error: `Git diff 失败: ${getErrorMessage(error)}` };
  }
};

export const gitLogTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_log',
    description: '查看 Git 提交历史',
    parameters: { type: 'object', description: '参数', properties: { count: { type: 'number', description: '显示条数，默认 10' }, path: { type: 'string', description: '仓库路径' } }, required: [] }
  }
};

export const gitLogHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string);
    const log = await git.log({ maxCount: (args.count as number) || 10 });
    return { success: true, output: log.all.map(e => `${e.hash.slice(0, 7)} ${e.date.slice(0, 10)} ${e.message}`).join('\n') || '暂无提交' };
  } catch (error) {
    return { success: false, output: '', error: `Git log 失败: ${getErrorMessage(error)}` };
  }
};

export const gitCommitTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_commit',
    description: '创建 Git 提交。会自动暂存修改的文件。',
    parameters: { type: 'object', description: '参数', properties: { message: { type: 'string', description: '提交信息' }, files: { type: 'array', items: { type: 'string', description: '文件路径' }, description: '要提交的文件列表，默认全部' }, path: { type: 'string', description: '仓库路径' } }, required: ['message'] }
  }
};

export const gitCommitHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string);
    const files = args.files as string[] | undefined;
    if (files && files.length > 0) await git.add(files); else await git.add('.');
    const result = await git.commit(args.message as string);
    return { success: true, output: `提交成功: ${result.commit}\n${result.summary.changes} 文件, +${result.summary.insertions} -${result.summary.deletions}` };
  } catch (error) {
    return { success: false, output: '', error: `Git 提交失败: ${getErrorMessage(error)}` };
  }
};

export const gitBranchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_branch',
    description: 'Git 分支管理：列出、创建或切换分支',
    parameters: { type: 'object', description: '参数', properties: { action: { type: 'string', description: '操作: list（列出）、create（创建）、switch（切换）' }, name: { type: 'string', description: '分支名（create/switch 时必填）' }, path: { type: 'string', description: '仓库路径' } }, required: ['action'] }
  }
};

export const gitBranchHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string | undefined);
    const action = args.action as string;
    const name = args.name as string | undefined;
    switch (action) {
      case 'list': {
        const branches = await git.branchLocal();
        return { success: true, output: branches.all.map(b => `${b === branches.current ? '* ' : '  '}${b}`).join('\n') };
      }
      case 'create': {
        if (!name) return { success: false, output: '', error: '创建分支需要指定 name 参数' };
        await git.checkoutLocalBranch(name);
        return { success: true, output: `已创建并切换到分支: ${name}` };
      }
      case 'switch': {
        if (!name) return { success: false, output: '', error: '切换分支需要指定 name 参数' };
        await git.checkout(name);
        return { success: true, output: `已切换到分支: ${name}` };
      }
      default: return { success: false, output: '', error: `未知操作: ${action}。支持: list, create, switch` };
    }
  } catch (error) {
    return { success: false, output: '', error: `Git branch 失败: ${getErrorMessage(error)}` };
  }
};

export const gitStageTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_stage',
    description: '将文件添加到 Git 暂存区',
    parameters: { type: 'object', description: '参数', properties: { files: { type: 'array', items: { type: 'string', description: '文件路径' }, description: '要暂存的文件列表' }, path: { type: 'string', description: '仓库路径' } }, required: ['files'] }
  }
};

export const gitStageHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string | undefined);
    const files = args.files as string[];
    await git.add(files);
    return { success: true, output: `已暂存: ${files.join(', ')}` };
  } catch (error) {
    return { success: false, output: '', error: `Git stage 失败: ${getErrorMessage(error)}` };
  }
};


// ==================== git_push ====================
export const gitPushTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_push',
    description: '推送本地提交到远程仓库。这是一个危险操作，需要用户确认。',
    parameters: {
      type: 'object', description: '参数',
      properties: {
        remote: { type: 'string', description: '远程名称，默认 origin' },
        branch: { type: 'string', description: '分支名，默认当前分支' },
        path: { type: 'string', description: '仓库路径' }
      },
      required: []
    }
  }
};

export const gitPushHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string | undefined);
    const remote = (args.remote as string) || 'origin';
    const branch = (args.branch as string) || (await git.branchLocal()).current;
    await git.push(remote, branch);
    return { success: true, output: `已推送 ${remote}/${branch}` };
  } catch (error) {
    return { success: false, output: '', error: `Git push 失败: ${getErrorMessage(error)}` };
  }
};

// ==================== git_stash ====================
export const gitStashTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_stash',
    description: 'Git stash 管理：暂存、恢复、删除、列出暂存区',
    parameters: {
      type: 'object', description: '参数',
      properties: {
        action: { type: 'string', description: '操作: save（暂存）、pop（恢复并删除）、list（列出）、drop（删除）' },
        message: { type: 'string', description: 'save 时的备注信息' },
        path: { type: 'string', description: '仓库路径' }
      },
      required: ['action']
    }
  }
};

export const gitStashHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string | undefined);
    const action = args.action as string;
    switch (action) {
      case 'save': {
        const msg = args.message ? ['-m', args.message as string] : [];
        await git.stash(msg);
        return { success: true, output: '已暂存当前修改' };
      }
      case 'pop': {
        await git.stash(['pop']);
        return { success: true, output: '已恢复暂存修改' };
      }
      case 'list': {
        const result = await git.stashList();
        if (result.all.length === 0) return { success: true, output: '暂存区为空' };
        return { success: true, output: result.all.map((s: { message: string }, i: number) => `stash@{${i}}: ${s.message}`).join('\n') };
      }
      case 'drop': {
        await git.stash(['drop']);
        return { success: true, output: '已删除最新暂存' };
      }
      default: return { success: false, output: '', error: `未知操作: ${action}` };
    }
  } catch (error) {
    return { success: false, output: '', error: `Git stash 失败: ${getErrorMessage(error)}` };
  }
};

// ==================== git_revert ====================
export const gitRevertTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'git_revert',
    description: '撤销提交或恢复文件到之前的状态。这是危险操作，需要用户确认。',
    parameters: {
      type: 'object', description: '参数',
      properties: {
        commit: { type: 'string', description: '要撤销的提交哈希' },
        file: { type: 'string', description: '恢复指定文件到最新提交的状态' },
        path: { type: 'string', description: '仓库路径' }
      },
      required: []
    }
  }
};

export const gitRevertHandler: ToolHandler = async (args): Promise<ToolResult> => {
  try {
    const git = getGit(args.path as string | undefined);
    if (args.file) {
      await git.checkout(['HEAD', '--', args.file as string]);
      return { success: true, output: `已恢复文件: ${args.file}` };
    }
    if (args.commit) {
      await git.revert(args.commit as string);
      return { success: true, output: `已撤销提交: ${args.commit}` };
    }
    return { success: false, output: '', error: '请指定 commit 或 file 参数' };
  } catch (error) {
    return { success: false, output: '', error: `Git revert 失败: ${getErrorMessage(error)}` };
  }
};

// Update registerGitTools to include new tools
export function registerGitTools(registry: ToolRegistry): void {
  registry.register(gitStatusTool, gitStatusHandler, { readOnly: true, cost: 'low', maxOutputLength: 5000 });
  registry.register(gitDiffTool, gitDiffHandler, { readOnly: true, cost: 'low', maxOutputLength: 12000 });
  registry.register(gitLogTool, gitLogHandler, { readOnly: true, cost: 'low', maxOutputLength: 3000 });
  registry.register(gitCommitTool, gitCommitHandler, { readOnly: false, cost: 'high', maxOutputLength: 2000 });
  registry.register(gitBranchTool, gitBranchHandler, { readOnly: false, cost: 'medium', maxOutputLength: 2000 });
  registry.register(gitStageTool, gitStageHandler, { readOnly: false, cost: 'medium', maxOutputLength: 2000 });
  registry.register(gitPushTool, gitPushHandler, { readOnly: false, cost: 'high', maxOutputLength: 2000 });
  registry.register(gitStashTool, gitStashHandler, { readOnly: true, cost: 'low', maxOutputLength: 3000 });
  registry.register(gitRevertTool, gitRevertHandler, { readOnly: false, cost: 'high', maxOutputLength: 2000 });
}
