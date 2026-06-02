#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("./commands/config");
const chat_1 = require("./commands/chat");
const ai_1 = require("./core/ai");
const config_2 = require("./core/config");
const logger_1 = require("./utils/logger");
const spinner_1 = require("./utils/spinner");
const program = new commander_1.Command();
program
    .name('mimo')
    .description('MiMo CLI - terminal AI coding assistant powered by MiMo')
    .version('1.0.0', '-v, --version', 'show version');
// 注册 config 子命令
(0, config_1.registerConfigCommand)(program);
// mimo models —— 查看可用模型列表
program
    .command('models')
    .description('list available API models')
    .action(async () => {
    const current = (0, config_2.get)('model');
    const spinner = (0, spinner_1.createSpinner)('Fetching models...');
    spinner.start();
    const result = await (0, ai_1.fetchModels)();
    spinner.stop();
    if (!result.success) {
        logger_1.log.error(result.error);
        return;
    }
    console.log('');
    console.log(chalk_1.default.cyan.bold('  Available models:'));
    console.log('');
    for (const m of result.models) {
        const marker = m === current ? chalk_1.default.green('  * ') : '    ';
        const name = m === current ? chalk_1.default.green.bold(m) : m;
        console.log(`${marker}${name}`);
    }
    console.log('');
    logger_1.log.info(`Current model: ${chalk_1.default.green.bold(current)}`);
    logger_1.log.dim('Switch model: mimo config set model <model>');
    console.log('');
});
// 默认命令：进入交互式对话
program
    .action(async () => {
    await (0, chat_1.startChat)();
});
// 也支持 mimo chat 显式调用
program
    .command('chat')
    .description('start interactive chat')
    .action(async () => {
    await (0, chat_1.startChat)();
});
program.parse();
//# sourceMappingURL=index.js.map