"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startChat = startChat;
const os_1 = __importDefault(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const context_1 = require("../core/context");
const ai_1 = require("../core/ai");
const config_1 = require("../core/config");
const registry_1 = require("../tools/registry");
const tools_1 = require("../tools");
const memory_1 = require("../core/memory");
const logger_1 = require("../utils/logger");
const layout_1 = require("../ui/layout");
const components_1 = require("../ui/components");
// ── 任务管理 ──
const tasks = [];
let taskCounter = 0;
function addTask(name) {
    const idx = taskCounter++;
    tasks.push({ name, status: 'running' });
    (0, layout_1.refreshTaskPanel)(tasks);
    return idx;
}
function completeTask(index, success) {
    if (tasks[index]) {
        tasks[index].status = success ? 'completed' : 'failed';
        (0, layout_1.refreshTaskPanel)(tasks);
    }
}
// ── 首次配置 ──
async function firstTimeSetup() {
    console.log('');
    console.log(chalk_1.default.cyan.bold('MiMo CLI setup'));
    console.log(chalk_1.default.dim('Configure the API endpoint and key to start.'));
    console.log('');
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const defaultUrl = (0, config_1.get)('baseUrl');
    const baseUrlInput = await new Promise((resolve) => rl.question(chalk_1.default.yellow('  API URL') + chalk_1.default.dim(` (default ${defaultUrl}): `), resolve));
    const baseUrl = baseUrlInput.trim() || defaultUrl;
    (0, config_1.set)('baseUrl', baseUrl);
    logger_1.log.success(`  API URL: ${baseUrl}`);
    console.log('');
    let apiKey = '';
    while (!apiKey) {
        apiKey = await new Promise((resolve) => rl.question(chalk_1.default.yellow('  API Key') + chalk_1.default.dim(' (required): '), resolve));
        apiKey = apiKey.trim();
        if (!apiKey)
            logger_1.log.warn('  API Key cannot be empty');
    }
    (0, config_1.set)('apiKey', apiKey);
    logger_1.log.success(`  API Key: ${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`);
    console.log('');
    rl.close();
}
// ── Tool Call Loop ──
const MAX_TOOL_ROUNDS = 10;
async function processUserInput(input, ctx) {
    ctx.addUserMessage(input);
    let rounds = 0;
    while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;
        const taskId = addTask(`turn ${rounds}`);
        let responseText = '';
        let reasoningText = '';
        let toolCalls = [];
        let usage;
        (0, layout_1.appendChat)((0, components_1.createUserMessage)(input));
        (0, layout_1.setActivityStatus)('thinking');
        (0, layout_1.appendChat)((0, components_1.createAiMessage)(chalk_1.default.dim('thinking...')));
        await (0, ai_1.chatStream)(ctx.getMessages(), {
            onToken: (token) => { responseText += token; },
            onThinking: (text) => { reasoningText += text; },
            onToolCalls: (calls) => { toolCalls = calls; },
            onDone: (fullText, calls, u) => {
                responseText = fullText;
                if (calls)
                    toolCalls = calls;
                if (u)
                    usage = u;
            },
            onError: (error) => {
                (0, layout_1.appendChat)((0, components_1.createAiMessage)(chalk_1.default.red.bold('[error] ') + error.message));
            },
        }, registry_1.toolRegistry.getDefinitions());
        (0, layout_1.setActivityStatus)('idle');
        // 渲染回复：移除之前的 "思考中..." 行，替换为实际内容
        if (reasoningText) {
            (0, layout_1.appendChat)((0, components_1.createThinkingBlock)('thinking done'));
        }
        if (toolCalls.length > 0) {
            ctx.addAssistantMessage(responseText, toolCalls, reasoningText || undefined);
            (0, layout_1.appendChat)((0, components_1.createAiMessage)(''));
            toolCalls.forEach((tc, i) => {
                let args = '';
                try {
                    const parsed = JSON.parse(tc.function.arguments);
                    args = formatToolArgs(tc.function.name, parsed);
                }
                catch {
                    args = tc.function.arguments.slice(0, 60);
                }
                (0, layout_1.appendChat)((0, components_1.createToolCallCard)(tc.function.name, args));
            });
            (0, layout_1.setActivityStatus)('tool_call');
            for (const tc of toolCalls) {
                const toolDef = registry_1.toolRegistry.get(tc.function.name);
                if (!toolDef) {
                    ctx.addToolMessage(tc.id, '{"error":"unknown tool"}');
                    (0, layout_1.appendChat)(chalk_1.default.red(`  [error] ${tc.function.name}: unknown`));
                    continue;
                }
                let args = {};
                try {
                    args = JSON.parse(tc.function.arguments);
                }
                catch {
                    args = {};
                }
                const result = await registry_1.toolRegistry.execute(tc.function.name, args);
                ctx.addToolMessage(tc.id, result.success ? result.output : `Error: ${result.error || '失败'}`);
                const icon = result.success ? chalk_1.default.green('[ok]') : chalk_1.default.red('[error]');
                (0, layout_1.appendChat)(`  ${icon} ${chalk_1.default.cyan(tc.function.name)}`);
                if (result.output && result.output.length < 200) {
                    (0, layout_1.appendChat)(chalk_1.default.dim(`    ${result.output.replace(/\n/g, '\n    ')}`));
                }
                else if (result.output) {
                    (0, layout_1.appendChat)(chalk_1.default.dim(`    ${result.output.slice(0, 150)}...`));
                }
            }
            (0, layout_1.setActivityStatus)('idle');
            completeTask(taskId, true);
            continue;
        }
        // 普通文本回复
        if (responseText) {
            ctx.addAssistantMessage(responseText, undefined, reasoningText || undefined);
            (0, layout_1.appendChat)((0, components_1.createAiMessage)(responseText));
        }
        if (usage)
            (0, layout_1.refreshAll)(usage);
        completeTask(taskId, true);
        break;
    }
}
function formatToolArgs(name, args) {
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
async function handleCommand(input, ctx) {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');
    switch (cmd) {
        case '/quit':
        case '/exit': return 'quit';
        case '/clear':
            ctx.reset();
            (0, layout_1.clearChat)();
            (0, layout_1.appendChat)(chalk_1.default.green('[ok] Context cleared'));
            return;
        case '/help':
            (0, layout_1.appendChat)('');
            (0, layout_1.appendChat)(chalk_1.default.cyan.bold('  Commands'));
            (0, layout_1.appendChat)(chalk_1.default.dim('  -------------------------'));
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/help')}        show help`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/clear')}       clear context`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/compact')}     compact context`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/model')} <name> switch model`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/mode')} <mode>  permission mode`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/think')}       cycle thinking mode`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/models')}      list models`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/read')} <path>  read file`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/write')} <path> write last code block`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/diff')} <path>  show diff`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/run')} <cmd>    run command`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/git')}         git status`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/commit')} <msg> git commit`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/save')}        save session`);
            (0, layout_1.appendChat)(`  ${chalk_1.default.yellow('/quit')}        quit`);
            (0, layout_1.appendChat)('');
            return;
        case '/models': {
            const current = (0, config_1.get)('model');
            const result = await (0, ai_1.fetchModels)();
            if (!result.success) {
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${result.error}`));
                return;
            }
            (0, layout_1.appendChat)('');
            for (const m of result.models) {
                const active = m === current;
                (0, layout_1.appendChat)(`${active ? chalk_1.default.green('  * ') : '    '}${active ? chalk_1.default.green.bold(m) : m}`);
            }
            (0, layout_1.appendChat)(chalk_1.default.dim(`Current: ${current}  Switch: /model <name>`));
            return;
        }
        case '/model': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /model <model>'));
                return;
            }
            (0, config_1.set)('model', arg);
            (0, layout_1.renderTopBar)();
            (0, layout_1.appendChat)(chalk_1.default.green(`[ok] model: ${arg}`));
            return;
        }
        case '/mode': {
            if (!arg || !['default', 'yolo', 'plan'].includes(arg)) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /mode <default|yolo|plan>'));
                return;
            }
            (0, config_1.set)('permissionMode', arg);
            (0, layout_1.renderTopBar)();
            (0, layout_1.renderFooterBar)();
            (0, layout_1.appendChat)(chalk_1.default.green(`[ok] permission: ${arg}`));
            return;
        }
        case '/think': {
            const cur = (0, config_1.get)('thinkingMode');
            const modes = ['think', 'nothink', 'auto'];
            const next = modes[(modes.indexOf(cur) + 1) % modes.length];
            (0, config_1.set)('thinkingMode', next);
            (0, layout_1.appendChat)(chalk_1.default.green(`[ok] thinking: ${cur} -> ${next}`));
            return;
        }
        case '/compact': {
            const msgs = ctx.getMessages();
            if (msgs.length <= 2) {
                (0, layout_1.appendChat)(chalk_1.default.dim('Already compact'));
                return;
            }
            const sys = msgs[0];
            const recent = msgs.slice(-4);
            const removed = msgs.length - 1 - recent.length;
            if (removed > 0) {
                ctx.replaceMessages([sys, { role: 'user', content: `[已压缩 ${removed} 条]` }, ...recent]);
                (0, layout_1.appendChat)(chalk_1.default.green(`[ok] compacted ${removed} messages`));
            }
            return;
        }
        case '/read': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /read <path>'));
                return;
            }
            const r = await registry_1.toolRegistry.execute('read_file', { path: arg });
            if (r.success) {
                (0, layout_1.appendChat)(chalk_1.default.green(`[ok] ${arg}`));
                ctx.addUserMessage(`[文件 ${arg}]:\n\`\`\`\n${r.output}\n\`\`\``);
            }
            else
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
            return;
        }
        case '/write': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /write <path>'));
                return;
            }
            const msgs = ctx.getMessages();
            const last = [...msgs].reverse().find((m) => m.role === 'assistant');
            if (!last) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('No assistant message found'));
                return;
            }
            const code = last.content.match(/```[\w]*\n([\s\S]*?)```/);
            if (!code) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('No code block found'));
                return;
            }
            const r = await registry_1.toolRegistry.execute('write_file', { path: arg, content: code[1] });
            if (r.success)
                (0, layout_1.appendChat)(chalk_1.default.green(`[ok] ${arg}`));
            else
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
            return;
        }
        case '/diff': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /diff <path>'));
                return;
            }
            const r = await registry_1.toolRegistry.execute('diff_file', { path: arg });
            if (r.success)
                (0, layout_1.appendChat)(r.output || 'No diff');
            else
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
            return;
        }
        case '/run': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /run <command>'));
                return;
            }
            (0, layout_1.setActivityStatus)('tool_call');
            const r = await registry_1.toolRegistry.execute('run_command', { command: arg });
            (0, layout_1.setActivityStatus)('idle');
            if (r.success) {
                (0, layout_1.appendChat)(chalk_1.default.green('[ok] success'));
                if (r.output)
                    (0, layout_1.appendChat)(chalk_1.default.dim(r.output));
            }
            else {
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
                if (r.output)
                    (0, layout_1.appendChat)(chalk_1.default.dim(r.output));
            }
            return;
        }
        case '/git': {
            const r = await registry_1.toolRegistry.execute('git_status', {});
            if (r.success)
                (0, layout_1.appendChat)(r.output);
            else
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
            return;
        }
        case '/commit': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /commit <msg>'));
                return;
            }
            const r = await registry_1.toolRegistry.execute('git_commit', { message: arg });
            if (r.success)
                (0, layout_1.appendChat)(r.output);
            else
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] ${r.error}`));
            return;
        }
        case '/save': {
            const msgs = ctx.getMessages();
            const content = msgs.map((m) => {
                if (m.role === 'system')
                    return `# System\n${m.content}`;
                if (m.role === 'user')
                    return `## You\n${m.content}`;
                if (m.role === 'assistant')
                    return `## MiMo\n${m.content}`;
                if (m.role === 'tool')
                    return `### Tool\n${m.content}`;
                return '';
            }).filter(Boolean).join('\n\n---\n\n');
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const file = `.mimo/session-${ts}.md`;
            try {
                const fs = require('fs');
                const dir = require('path').dirname(file);
                if (!fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(file, content, 'utf-8');
                (0, layout_1.appendChat)(chalk_1.default.green(`[ok] ${file}`));
            }
            catch {
                (0, layout_1.appendChat)(chalk_1.default.red('[error] save failed'));
            }
            return;
        }
        // Agent mode
        case '/agent': {
            if (!arg) {
                (0, layout_1.appendChat)(chalk_1.default.yellow('Usage: /agent <task description>'));
                return;
            }
            (0, layout_1.appendChat)(chalk_1.default.cyan('Agent mode starting...'));
            (0, layout_1.appendChat)(chalk_1.default.dim('Decomposing task...'));
            // Dynamic import to avoid circular dependency
            const { decomposeTask } = await Promise.resolve().then(() => __importStar(require('../agent/planner')));
            const { executePlan } = await Promise.resolve().then(() => __importStar(require('../agent/executor')));
            const planResult = await decomposeTask(arg);
            if (!planResult.success || !planResult.plan) {
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] Task decomposition failed: ${planResult.error}`));
                return;
            }
            const plan = planResult.plan;
            (0, layout_1.appendChat)(chalk_1.default.green(`[ok] Task decomposed into ${plan.steps.length} steps`));
            // Show plan
            for (const step of plan.steps) {
                (0, layout_1.appendChat)(`  ${step.id}. ${step.description}`);
            }
            // Execute plan
            const result = await executePlan(plan, {
                onStepStart: (step, total) => {
                    (0, layout_1.appendChat)(chalk_1.default.dim(`Executing step ${step}/${total}...`));
                },
                onStepComplete: (step, total, success) => {
                    const icon = success ? chalk_1.default.green('[ok]') : chalk_1.default.red('[error]');
                    (0, layout_1.appendChat)(`${icon} Step ${step}/${total}`);
                },
                onConfirm: async (description) => {
                    // In a real implementation, this would ask the user
                    // For now, auto-confirm
                    return true;
                },
            });
            if (result.success) {
                (0, layout_1.appendChat)(chalk_1.default.green('[ok] Agent task completed'));
            }
            else {
                (0, layout_1.appendChat)(chalk_1.default.red(`[error] Agent task failed: ${result.output}`));
            }
            return;
        }
        default:
            (0, layout_1.appendChat)(chalk_1.default.yellow(`Unknown command: ${cmd}`));
            return;
    }
}
// ── 主入口 ──
async function startChat() {
    if (!(0, config_1.isConfigured)()) {
        await firstTimeSetup();
    }
    (0, tools_1.registerAllTools)();
    const maxContextTokens = (0, config_1.get)('maxContextTokens');
    const ctx = new context_1.ContextManager(maxContextTokens);
    // 初始化 ANSI 布局
    (0, layout_1.initLayout)();
    // 项目记忆
    const memory = new memory_1.ProjectMemory();
    if (memory.exists()) {
        (0, layout_1.appendChat)(chalk_1.default.dim('  [memory] Loaded project memory'));
    }
    // 欢迎
    const username = os_1.default.userInfo().username;
    (0, layout_1.appendChat)('');
    (0, layout_1.appendChat)(chalk_1.default.cyan.bold('MiMo CLI'));
    (0, layout_1.appendChat)(chalk_1.default.dim(`Welcome, ${username}. Type a message to start.`));
    (0, layout_1.appendChat)(chalk_1.default.dim('/help for commands'));
    (0, layout_1.appendChat)('');
    // 输入循环
    (0, layout_1.startInputLoop)(async (trimmed) => {
        if (!trimmed) {
            (0, layout_1.continueInputLoop)();
            return;
        }
        if (trimmed.startsWith('/')) {
            const handled = await handleCommand(trimmed, ctx);
            if (handled === 'quit') {
                (0, layout_1.stopInputLoop)();
                process.exit(0);
                return;
            }
            (0, layout_1.continueInputLoop)();
            return;
        }
        await processUserInput(trimmed, ctx);
        (0, layout_1.continueInputLoop)();
    });
}
//# sourceMappingURL=chat.js.map