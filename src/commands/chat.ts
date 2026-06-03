import os from 'os';
import chalk from 'chalk';
import { ContextManager } from '../core/context';
import { chatStream, fetchModels, TokenUsage } from '../core/ai';
import { get, set, isConfigured } from '../core/config';
import { toolRegistry } from '../tools/registry';
import { registerAllTools } from '../tools';
import { ProjectMemory } from '../core/memory';
import { TUIApp } from '../ui/app';
import { StreamRenderer } from '../ui/stream-renderer';
import { PermissionUI } from '../ui/permission-ui';
import { PermissionDecision } from '../ui/theme';

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
  console.log(chalk.green('[ok]') + ` API URL: ${baseUrl}`);
  console.log('');

  let apiKey = '';
  while (!apiKey) {
    apiKey = await new Promise<string>((resolve) =>
      rl.question(chalk.yellow('  API Key') + chalk.dim(' (required): '), resolve),
    );
    apiKey = apiKey.trim();
    if (!apiKey) console.log(chalk.yellow('[warn]') + ' API Key cannot be empty');
  }
  set('apiKey', apiKey);
  console.log(chalk.green('[ok]') + ` API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`);
  console.log('');

  rl.close();
}

// ── Tool Call Loop ──

const MAX_TOOL_ROUNDS = 10;

async function processUserInput(
  input: string,
  ctx: ContextManager,
  renderer: StreamRenderer,
  permissionUI: PermissionUI,
): Promise<void> {
  ctx.addUserMessage(input);

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    let responseText = '';
    let reasoningText = '';
    let toolCalls: import('../core/context').ToolCall[] = [];
    let usage: TokenUsage | undefined;
    const turnStartTime = Date.now();

    // 在 ChatBox 中显示用户消息和模型标记
    renderer.getChatBox().pushUserMessage(input);
    renderer.getChatBox().pushAssistantHeader(get('model'));

    await chatStream(
      ctx.getMessages(),
      {
        onToken: (token) => {
          if (!renderer.getIsStreaming()) {
            renderer.startStreaming();
          }
          renderer.appendToken(token);
          responseText += token;
        },
        onThinking: (text) => {
          reasoningText += text;
        },
        onThinkingStart: () => {
          renderer.startThinking();
        },
        onThinkingContent: (_content) => {
          renderer.updateThinking(_content);
        },
        onThinkingEnd: () => {
          renderer.endThinking();
        },
        onToolCalls: (calls) => {
          toolCalls = calls;
        },
        onDone: (fullText, calls, u) => {
          responseText = fullText;
          if (calls) toolCalls = calls;
          if (u) usage = u;
        },
        onError: (error) => {
          renderer.pushError(error.message);
        },
        onStreamEnd: (u) => {
          if (u) usage = u;
          const duration = Date.now() - turnStartTime;
          renderer.endStreaming(u?.total_tokens || 0, duration);
        },
      },
      toolRegistry.getDefinitions(),
    );

    // 处理工具调用
    if (toolCalls.length > 0) {
      ctx.addAssistantMessage(responseText, toolCalls, reasoningText || undefined);

      for (const tc of toolCalls) {
        const toolDef = toolRegistry.get(tc.function.name);
        if (!toolDef) {
          ctx.addToolMessage(tc.id, '{"error":"unknown tool"}');
          renderer.pushError(`unknown tool: ${tc.function.name}`);
          continue;
        }

        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        // 格式化工具参数摘要
        const argsSummary = formatToolArgs(tc.function.name, args);

        // 权限检查
        if (toolDef.definition.permission !== 'read') {
          const decision = await permissionUI.requestPermission(tc.function.name, argsSummary);
          if (decision === 'deny') {
            ctx.addToolMessage(tc.id, '{"error":"permission denied"}');
            renderer.endToolCall(tc.function.name, argsSummary, false, 0);
            continue;
          }
          if (decision === 'always') {
            set('permissionMode', 'yolo' as any);
          }
        }

        // 执行工具
        const toolStartTime = Date.now();
        renderer.startToolCall(tc.function.name, argsSummary);

        const result = await toolRegistry.execute(tc.function.name, args);
        const toolDuration = Date.now() - toolStartTime;

        ctx.addToolMessage(tc.id, result.success ? result.output : `Error: ${result.error || '失败'}`);
        renderer.endToolCall(tc.function.name, argsSummary, result.success, toolDuration);
      }

      continue;
    }

    // 普通文本回复
    if (responseText) {
      ctx.addAssistantMessage(responseText, undefined, reasoningText || undefined);
    }

    break;
  }
}

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file':
      return String(args.path || '');
    case 'write_file':
      return String(args.path || '');
    case 'edit_file':
      return String(args.path || '');
    case 'run_command':
      return String(args.command || '').slice(0, 50);
    case 'list_dir':
      return String(args.path || '.');
    case 'grep':
      return `"${args.pattern}"`;
    case 'find_files':
      return String(args.pattern || '');
    case 'git_status':
      return '';
    case 'git_diff':
      return String(args.file || '');
    case 'git_commit':
      return String(args.message || '').slice(0, 50);
    case 'git_log':
      return `last ${args.count || 10}`;
    default:
      return JSON.stringify(args).slice(0, 50);
  }
}

// ── 斜杠指令 ──

async function handleCommand(
  input: string,
  ctx: ContextManager,
  renderer: StreamRenderer,
  permissionUI: PermissionUI,
): Promise<string | undefined> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(' ');
  const chatbox = renderer.getChatBox();

  switch (cmd) {
    case '/quit':
    case '/exit':
      return 'quit';

    case '/clear':
      ctx.reset();
      chatbox.clear();
      chatbox.pushText('{green-fg}[ok] Context cleared{/green-fg}');
      return;

    case '/help': {
      const commands: [string, string][] = [
        ['help', '显示帮助信息'],
        ['clear', '清空对话上下文'],
        ['compact', '压缩上下文'],
        ['model <name>', '切换模型'],
        ['mode <mode>', '权限模式'],
        ['think', '切换思考模式'],
        ['models', '列出可用模型'],
        ['read <path>', '读取文件'],
        ['write <path>', '写入文件'],
        ['diff <path>', '查看差异'],
        ['run <cmd>', '执行命令'],
        ['git', 'Git 状态'],
        ['commit <msg>', '提交更改'],
        ['save', '保存对话'],
        ['agent <task>', 'Agent 模式'],
        ['quit', '退出'],
      ];
      chatbox.pushText('{cyan-fg}{bold}Commands{/bold}{/cyan-fg}');
      for (const [name, desc] of commands) {
        chatbox.pushText(`  {yellow-fg}/${name}{/yellow-fg}  ${desc}`);
      }
      chatbox.pushText('');
      return;
    }

    case '/models': {
      const current = get('model');
      const result = await fetchModels();
      if (!result.success) {
        chatbox.pushError(result.error!);
        return;
      }
      chatbox.pushText('');
      for (const m of result.models!) {
        const active = m === current;
        if (active) {
          chatbox.pushText(`  {green-fg}* {bold}${m}{/bold}{/green-fg}`);
        } else {
          chatbox.pushText(`    ${m}`);
        }
      }
      chatbox.pushText(`{gray-fg}Current: ${current}  Switch: /model <name>{/gray-fg}`);
      return;
    }

    case '/model': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /model <model>{/yellow-fg}');
        return;
      }
      set('model', arg);
      chatbox.pushText(`{green-fg}[ok] model: ${arg}{/green-fg}`);
      return;
    }

    case '/mode': {
      if (!arg || !['default', 'yolo', 'plan'].includes(arg)) {
        chatbox.pushText('{yellow-fg}Usage: /mode <default|yolo|plan>{/yellow-fg}');
        return;
      }
      set('permissionMode', arg as any);
      chatbox.pushText(`{green-fg}[ok] permission: ${arg}{/green-fg}`);
      return;
    }

    case '/think': {
      const cur = get('thinkingMode');
      const modes: Array<'think' | 'nothink' | 'auto'> = ['think', 'nothink', 'auto'];
      const next = modes[(modes.indexOf(cur) + 1) % modes.length];
      set('thinkingMode', next);
      chatbox.pushText(`{green-fg}[ok] thinking: ${cur} -> ${next}{/green-fg}`);
      return;
    }

    case '/compact': {
      const msgs = ctx.getMessages();
      if (msgs.length <= 2) {
        chatbox.pushText('{gray-fg}Already compact{/gray-fg}');
        return;
      }
      const sys = msgs[0];
      const recent = msgs.slice(-4);
      const removed = msgs.length - 1 - recent.length;
      if (removed > 0) {
        ctx.replaceMessages([sys, { role: 'user', content: `[已压缩 ${removed} 条]` }, ...recent]);
        chatbox.pushText(`{green-fg}[ok] compacted ${removed} messages{/green-fg}`);
      }
      return;
    }

    case '/read': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /read <path>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('read_file', { path: arg });
      if (r.success) {
        chatbox.pushText(`{green-fg}[ok] ${arg}{/green-fg}`);
        ctx.addUserMessage(`[文件 ${arg}]:\n\`\`\`\n${r.output}\n\`\`\``);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/write': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /write <path>{/yellow-fg}');
        return;
      }
      const msgs = ctx.getMessages();
      const last = [...msgs].reverse().find((m) => m.role === 'assistant');
      if (!last) {
        chatbox.pushText('{yellow-fg}No assistant message found{/yellow-fg}');
        return;
      }
      const code = last.content.match(/```[\w]*\n([\s\S]*?)```/);
      if (!code) {
        chatbox.pushText('{yellow-fg}No code block found{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('write_file', { path: arg, content: code[1] });
      if (r.success) {
        chatbox.pushText(`{green-fg}[ok] ${arg}{/green-fg}`);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/diff': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /diff <path>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('diff_file', { path: arg });
      if (r.success) {
        chatbox.pushText(r.output || 'No diff');
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/run': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /run <command>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('run_command', { command: arg });
      if (r.success) {
        chatbox.pushText('{green-fg}[ok] success{/green-fg}');
        if (r.output) chatbox.pushText(`{gray-fg}${r.output}{/gray-fg}`);
      } else {
        chatbox.pushError(r.error!);
        if (r.output) chatbox.pushText(`{gray-fg}${r.output}{/gray-fg}`);
      }
      return;
    }

    case '/git': {
      const r = await toolRegistry.execute('git_status', {});
      if (r.success) {
        chatbox.pushText(r.output);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/commit': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /commit <msg>{/yellow-fg}');
        return;
      }
      const r = await toolRegistry.execute('git_commit', { message: arg });
      if (r.success) {
        chatbox.pushText(r.output);
      } else {
        chatbox.pushError(r.error!);
      }
      return;
    }

    case '/save': {
      const msgs = ctx.getMessages();
      const content = msgs
        .map((m) => {
          if (m.role === 'system') return `# System\n${m.content}`;
          if (m.role === 'user') return `## You\n${m.content}`;
          if (m.role === 'assistant') return `## MiMo\n${m.content}`;
          if (m.role === 'tool') return `### Tool\n${m.content}`;
          return '';
        })
        .filter(Boolean)
        .join('\n\n---\n\n');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = `.mimo/session-${ts}.md`;
      try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.dirname(file);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, content, 'utf-8');
        chatbox.pushText(`{green-fg}[ok] ${file}{/green-fg}`);
      } catch {
        chatbox.pushError('save failed');
      }
      return;
    }

    case '/agent': {
      if (!arg) {
        chatbox.pushText('{yellow-fg}Usage: /agent <task description>{/yellow-fg}');
        return;
      }

      chatbox.pushText('{cyan-fg}Agent mode starting...{/cyan-fg}');

      const { decomposeTask } = await import('../agent/planner');
      const { executePlan } = await import('../agent/executor');

      const planResult = await decomposeTask(arg);
      if (!planResult.success || !planResult.plan) {
        chatbox.pushError(`Task decomposition failed: ${planResult.error}`);
        return;
      }

      const plan = planResult.plan;
      chatbox.pushText(`{green-fg}[ok] Task decomposed into ${plan.steps.length} steps{/green-fg}`);

      for (const step of plan.steps) {
        chatbox.pushText(`  ${step.id}. ${step.description}`);
      }

      const result = await executePlan(plan, {
        onStepStart: (step, total) => {
          chatbox.pushText(`{gray-fg}Executing step ${step}/${total}...{/gray-fg}`);
        },
        onStepComplete: (step, total, success) => {
          const icon = success ? '{green-fg}[ok]{/green-fg}' : '{red-fg}[error]{/red-fg}';
          chatbox.pushText(`${icon} Step ${step}/${total}`);
        },
        onConfirm: async () => true,
      });

      if (result.success) {
        chatbox.pushText('{green-fg}[ok] Agent task completed{/green-fg}');
      } else {
        chatbox.pushError(`Agent task failed: ${result.output}`);
      }
      return;
    }

    default:
      chatbox.pushText(`{yellow-fg}Unknown command: ${cmd}{/yellow-fg}`);
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

  // 创建 TUI
  const app = new TUIApp({
    model: get('model'),
    permissionMode: get('permissionMode'),
    version: '1.0.0',
  });

  const renderer = app.getStreamRenderer();
  const permissionUI = app.getPermissionUI();

  // 项目记忆
  const memory = new ProjectMemory();
  if (memory.exists()) {
    renderer.getChatBox().pushText('{gray-fg}[memory] Loaded project memory{/gray-fg}');
  }

  // 启动 TUI
  app.start();

  // 输入事件处理
  app.on('input', async (text: string) => {
    // 停用输入 (防止输入干扰)
    app.getInputBox().deactivate();

    if (text.startsWith('/')) {
      const handled = await handleCommand(text, ctx, renderer, permissionUI);
      if (handled === 'quit') {
        app.stop();
        process.exit(0);
      }
    } else {
      await processUserInput(text, ctx, renderer, permissionUI);
    }

    // 重新激活输入
    app.getInputBox().activate();
  });

  // 退出事件
  app.on('quit', () => {
    app.stop();
    process.exit(0);
  });

  // 清屏事件
  app.on('clear', () => {
    ctx.reset();
  });
}
