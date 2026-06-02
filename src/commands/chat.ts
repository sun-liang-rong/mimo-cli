import os from 'os';
import chalk from 'chalk';
import { ContextManager } from '../core/context';
import { chatStream, fetchModels, TokenUsage } from '../core/ai';
import { get, set, isConfigured } from '../core/config';
import { toolRegistry } from '../tools/registry';
import { registerAllTools } from '../tools';
import { ProjectMemory } from '../core/memory';
import { log } from '../utils/logger';
import {
  initLayout, renderTopBar, renderFooterBar, setActivityStatus,
  appendChat, clearChat, refreshTaskPanel, refreshAll,
  startInputLoop, continueInputLoop, stopInputLoop,
  TaskInfo,
} from '../ui/layout';
import { createUserMessage, createAiMessage, createToolCallCard, createThinkingBlock } from '../ui/components';

// ── 任务管理 ──

const tasks: TaskInfo[] = [];
let taskCounter = 0;

function addTask(name: string): number {
  const idx = taskCounter++;
  tasks.push({ name, status: 'running' });
  refreshTaskPanel(tasks);
  return idx;
}

function completeTask(index: number, success: boolean): void {
  if (tasks[index]) {
    tasks[index].status = success ? 'completed' : 'failed';
    refreshTaskPanel(tasks);
  }
}

// ── 首次配置 ──

async function firstTimeSetup(): Promise<void> {
  console.log('');
  console.log(chalk.cyan.bold('MiMo CLI setup'));
  console.log(chalk.dim('Configure the API endpoint and key to start.'));
  console.log('');

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const defaultUrl = get('baseUrl');
  const baseUrlInput = await new Promise<string>((resolve) =>
    rl.question(chalk.yellow('  API URL') + chalk.dim(` (default ${defaultUrl}): `), resolve),
  );
  const baseUrl = baseUrlInput.trim() || defaultUrl;
  set('baseUrl', baseUrl);
  log.success(`  API URL: ${baseUrl}`);
  console.log('');

  let apiKey = '';
  while (!apiKey) {
    apiKey = await new Promise<string>((resolve) =>
      rl.question(chalk.yellow('  API Key') + chalk.dim(' (required): '), resolve),
    );
    apiKey = apiKey.trim();
    if (!apiKey) log.warn('  API Key cannot be empty');
  }
  set('apiKey', apiKey);
  log.success(`  API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`);
  console.log('');

  rl.close();
}

// ── Tool Call Loop ──

const MAX_TOOL_ROUNDS = 10;

async function processUserInput(input: string, ctx: ContextManager): Promise<void> {
  ctx.addUserMessage(input);

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const taskId = addTask(`turn ${rounds}`);
    let responseText = '';
    let reasoningText = '';
    let toolCalls: import('../core/context').ToolCall[] = [];
    let usage: TokenUsage | undefined;

    appendChat(createUserMessage(input));
    setActivityStatus('thinking');
        appendChat(createAiMessage(chalk.dim('thinking...')));

    await chatStream(ctx.getMessages(), {
      onToken: (token) => { responseText += token; },
      onThinking: (text) => { reasoningText += text; },
      onToolCalls: (calls) => { toolCalls = calls; },
      onDone: (fullText, calls, u) => {
        responseText = fullText;
        if (calls) toolCalls = calls;
        if (u) usage = u;
      },
      onError: (error) => {
        appendChat(createAiMessage(chalk.red.bold('[error] ') + error.message));
      },
    }, toolRegistry.getDefinitions());

    setActivityStatus('idle');

    // 渲染回复：移除之前的 "思考中..." 行，替换为实际内容
    if (reasoningText) {
      appendChat(createThinkingBlock('thinking done'));
    }

    if (toolCalls.length > 0) {
      ctx.addAssistantMessage(responseText, toolCalls, reasoningText || undefined);
      appendChat(createAiMessage(''));
      toolCalls.forEach((tc, i) => {
        let args = '';
        try {
          const parsed = JSON.parse(tc.function.arguments);
          args = formatToolArgs(tc.function.name, parsed);
        } catch { args = tc.function.arguments.slice(0, 60); }
        appendChat(createToolCallCard(tc.function.name, args));
      });

      setActivityStatus('tool_call');
      for (const tc of toolCalls) {
        const toolDef = toolRegistry.get(tc.function.name);
        if (!toolDef) {
          ctx.addToolMessage(tc.id, '{"error":"unknown tool"}');
          appendChat(chalk.red(`  [error] ${tc.function.name}: unknown`));
          continue;
        }
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

        const result = await toolRegistry.execute(tc.function.name, args);
        ctx.addToolMessage(tc.id, result.success ? result.output : `Error: ${result.error || '失败'}`);

        const icon = result.success ? chalk.green('[ok]') : chalk.red('[error]');
        appendChat(`  ${icon} ${chalk.cyan(tc.function.name)}`);
        if (result.output && result.output.length < 200) {
          appendChat(chalk.dim(`    ${result.output.replace(/\n/g, '\n    ')}`));
        } else if (result.output) {
          appendChat(chalk.dim(`    ${result.output.slice(0, 150)}...`));
        }
      }

      setActivityStatus('idle');
      completeTask(taskId, true);
      continue;
    }

    // 普通文本回复
    if (responseText) {
      ctx.addAssistantMessage(responseText, undefined, reasoningText || undefined);
      appendChat(createAiMessage(responseText));
    }

    if (usage) refreshAll(usage);
    completeTask(taskId, true);
    break;
  }
}

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file': return String(args.path || '');
    case 'write_file': return String(args.path || '');
    case 'edit_file': return String(args.path || '');
    case 'run_command': return String(args.command || '').slice(0, 50);
    case 'list_dir': return String(args.path || '.');
    case 'grep': return `"${args.pattern}"`;
    case 'find_files': return String(args.pattern || '');
    case 'git_status': return '';
    case 'git_diff': return String(args.file || '');
    case 'git_commit': return String(args.message || '').slice(0, 50);
    case 'git_log': return `last ${args.count || 10}`;
    default: return JSON.stringify(args).slice(0, 50);
  }
}

// ── 斜杠指令 ──

async function handleCommand(input: string, ctx: ContextManager): Promise<string | undefined> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/quit': case '/exit': return 'quit';

    case '/clear':
      ctx.reset();
      clearChat();
      appendChat(chalk.green('[ok] Context cleared'));
      return;

    case '/help':
      appendChat('');
      appendChat(chalk.cyan.bold('  Commands'));
      appendChat(chalk.dim('  -------------------------'));
      appendChat(`  ${chalk.yellow('/help')}        show help`);
      appendChat(`  ${chalk.yellow('/clear')}       clear context`);
      appendChat(`  ${chalk.yellow('/compact')}     compact context`);
      appendChat(`  ${chalk.yellow('/model')} <name> switch model`);
      appendChat(`  ${chalk.yellow('/mode')} <mode>  permission mode`);
      appendChat(`  ${chalk.yellow('/think')}       cycle thinking mode`);
      appendChat(`  ${chalk.yellow('/models')}      list models`);
      appendChat(`  ${chalk.yellow('/read')} <path>  read file`);
      appendChat(`  ${chalk.yellow('/write')} <path> write last code block`);
      appendChat(`  ${chalk.yellow('/diff')} <path>  show diff`);
      appendChat(`  ${chalk.yellow('/run')} <cmd>    run command`);
      appendChat(`  ${chalk.yellow('/git')}         git status`);
      appendChat(`  ${chalk.yellow('/commit')} <msg> git commit`);
      appendChat(`  ${chalk.yellow('/save')}        save session`);
      appendChat(`  ${chalk.yellow('/quit')}        quit`);
      appendChat('');
      return;

    case '/models': {
      const current = get('model');
      const result = await fetchModels();
      if (!result.success) { appendChat(chalk.red(`[error] ${result.error}`)); return; }
      appendChat('');
      for (const m of result.models!) {
        const active = m === current;
        appendChat(`${active ? chalk.green('  * ') : '    '}${active ? chalk.green.bold(m) : m}`);
      }
      appendChat(chalk.dim(`Current: ${current}  Switch: /model <name>`));
      return;
    }

    case '/model': {
      if (!arg) { appendChat(chalk.yellow('Usage: /model <model>')); return; }
      set('model', arg);
      renderTopBar();
      appendChat(chalk.green(`[ok] model: ${arg}`));
      return;
    }

    case '/mode': {
      if (!arg || !['default', 'yolo', 'plan'].includes(arg)) {
        appendChat(chalk.yellow('Usage: /mode <default|yolo|plan>'));
        return;
      }
      set('permissionMode', arg as any);
      renderTopBar();
      renderFooterBar();
      appendChat(chalk.green(`[ok] permission: ${arg}`));
      return;
    }

    case '/think': {
      const cur = get('thinkingMode');
      const modes: Array<'think' | 'nothink' | 'auto'> = ['think', 'nothink', 'auto'];
      const next = modes[(modes.indexOf(cur) + 1) % modes.length];
      set('thinkingMode', next);
      appendChat(chalk.green(`[ok] thinking: ${cur} -> ${next}`));
      return;
    }

    case '/compact': {
      const msgs = ctx.getMessages();
      if (msgs.length <= 2) { appendChat(chalk.dim('Already compact')); return; }
      const sys = msgs[0];
      const recent = msgs.slice(-4);
      const removed = msgs.length - 1 - recent.length;
      if (removed > 0) {
        ctx.replaceMessages([sys, { role: 'user', content: `[已压缩 ${removed} 条]` }, ...recent]);
        appendChat(chalk.green(`[ok] compacted ${removed} messages`));
      }
      return;
    }

    case '/read': {
      if (!arg) { appendChat(chalk.yellow('Usage: /read <path>')); return; }
      const r = await toolRegistry.execute('read_file', { path: arg });
      if (r.success) {
        appendChat(chalk.green(`[ok] ${arg}`));
        ctx.addUserMessage(`[文件 ${arg}]:\n\`\`\`\n${r.output}\n\`\`\``);
      } else appendChat(chalk.red(`[error] ${r.error}`));
      return;
    }

    case '/write': {
      if (!arg) { appendChat(chalk.yellow('Usage: /write <path>')); return; }
      const msgs = ctx.getMessages();
      const last = [...msgs].reverse().find((m) => m.role === 'assistant');
      if (!last) { appendChat(chalk.yellow('No assistant message found')); return; }
      const code = last.content.match(/```[\w]*\n([\s\S]*?)```/);
      if (!code) { appendChat(chalk.yellow('No code block found')); return; }
      const r = await toolRegistry.execute('write_file', { path: arg, content: code[1] });
      if (r.success) appendChat(chalk.green(`[ok] ${arg}`));
      else appendChat(chalk.red(`[error] ${r.error}`));
      return;
    }

    case '/diff': {
      if (!arg) { appendChat(chalk.yellow('Usage: /diff <path>')); return; }
      const r = await toolRegistry.execute('diff_file', { path: arg });
      if (r.success) appendChat(r.output || 'No diff');
      else appendChat(chalk.red(`[error] ${r.error}`));
      return;
    }

    case '/run': {
      if (!arg) { appendChat(chalk.yellow('Usage: /run <command>')); return; }
      setActivityStatus('tool_call');
      const r = await toolRegistry.execute('run_command', { command: arg });
      setActivityStatus('idle');
      if (r.success) {
        appendChat(chalk.green('[ok] success'));
        if (r.output) appendChat(chalk.dim(r.output));
      } else {
        appendChat(chalk.red(`[error] ${r.error}`));
        if (r.output) appendChat(chalk.dim(r.output));
      }
      return;
    }

    case '/git': {
      const r = await toolRegistry.execute('git_status', {});
      if (r.success) appendChat(r.output);
      else appendChat(chalk.red(`[error] ${r.error}`));
      return;
    }

    case '/commit': {
      if (!arg) { appendChat(chalk.yellow('Usage: /commit <msg>')); return; }
      const r = await toolRegistry.execute('git_commit', { message: arg });
      if (r.success) appendChat(r.output);
      else appendChat(chalk.red(`[error] ${r.error}`));
      return;
    }

    case '/save': {
      const msgs = ctx.getMessages();
      const content = msgs.map((m) => {
        if (m.role === 'system') return `# System\n${m.content}`;
        if (m.role === 'user') return `## You\n${m.content}`;
        if (m.role === 'assistant') return `## MiMo\n${m.content}`;
        if (m.role === 'tool') return `### Tool\n${m.content}`;
        return '';
      }).filter(Boolean).join('\n\n---\n\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = `.mimo/session-${ts}.md`;
      try {
        const fs = require('fs');
        const dir = require('path').dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, content, 'utf-8');
        appendChat(chalk.green(`[ok] ${file}`));
      } catch { appendChat(chalk.red('[error] save failed')); }
      return;
    }

    // Agent mode
    case '/agent': {
      if (!arg) {
        appendChat(chalk.yellow('Usage: /agent <task description>'));
        return;
      }

      appendChat(chalk.cyan('Agent mode starting...'));
      appendChat(chalk.dim('Decomposing task...'));

      // Dynamic import to avoid circular dependency
      const { decomposeTask } = await import('../agent/planner');
      const { executePlan } = await import('../agent/executor');

      const planResult = await decomposeTask(arg);
      if (!planResult.success || !planResult.plan) {
        appendChat(chalk.red(`[error] Task decomposition failed: ${planResult.error}`));
        return;
      }

      const plan = planResult.plan;
      appendChat(chalk.green(`[ok] Task decomposed into ${plan.steps.length} steps`));

      // Show plan
      for (const step of plan.steps) {
        appendChat(`  ${step.id}. ${step.description}`);
      }

      // Execute plan
      const result = await executePlan(plan, {
        onStepStart: (step, total) => {
          appendChat(chalk.dim(`Executing step ${step}/${total}...`));
        },
        onStepComplete: (step, total, success) => {
          const icon = success ? chalk.green('[ok]') : chalk.red('[error]');
          appendChat(`${icon} Step ${step}/${total}`);
        },
        onConfirm: async (description) => {
          // In a real implementation, this would ask the user
          // For now, auto-confirm
          return true;
        },
      });

      if (result.success) {
        appendChat(chalk.green('[ok] Agent task completed'));
      } else {
        appendChat(chalk.red(`[error] Agent task failed: ${result.output}`));
      }

      return;
    }

    default:
      appendChat(chalk.yellow(`Unknown command: ${cmd}`));
      return;
  }
}

// ── 主入口 ──

export async function startChat(): Promise<void> {
  if (!isConfigured()) {
    await firstTimeSetup();
  }

  registerAllTools();

  const maxContextTokens = get('maxContextTokens');
  const ctx = new ContextManager(maxContextTokens);

  // 初始化 ANSI 布局
  initLayout();

  // 项目记忆
  const memory = new ProjectMemory();
  if (memory.exists()) {
    appendChat(chalk.dim('  [memory] Loaded project memory'));
  }

  // 欢迎
  const username = os.userInfo().username;
  appendChat('');
  appendChat(chalk.cyan.bold('MiMo CLI'));
  appendChat(chalk.dim(`Welcome, ${username}. Type a message to start.`));
  appendChat(chalk.dim('/help for commands'));
  appendChat('');

  // 输入循环
  startInputLoop(async (trimmed: string) => {
    if (!trimmed) {
      continueInputLoop();
      return;
    }

    if (trimmed.startsWith('/')) {
      const handled = await handleCommand(trimmed, ctx);
      if (handled === 'quit') {
        stopInputLoop();
        process.exit(0);
        return;
      }
      continueInputLoop();
      return;
    }

    await processUserInput(trimmed, ctx);
    continueInputLoop();
  });
}
