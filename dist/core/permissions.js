"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPermission = checkPermission;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("./config");
const logger_1 = require("../utils/logger");
/**
 * 权限门控 — 判断工具调用是否需要用户确认
 */
async function checkPermission(toolDef, args, rl) {
    const mode = (0, config_1.get)('permissionMode');
    // plan 模式：只允许只读操作
    if (mode === 'plan') {
        if (toolDef.permission !== 'read') {
            logger_1.log.warn(`Plan 模式下禁止执行写入操作: ${toolDef.name}`);
            return false;
        }
        return true;
    }
    // yolo 模式：全部自动通过
    if (mode === 'yolo') {
        return true;
    }
    // default 模式：按权限级别判断
    if (toolDef.permission === 'read') {
        return true; // 只读操作自动通过
    }
    // 写入/危险操作需要确认
    return promptConfirm(toolDef, args, rl);
}
function promptConfirm(toolDef, args, rl) {
    return new Promise((resolve) => {
        const label = formatToolCall(toolDef, args);
        console.log('');
        console.log(chalk_1.default.yellow.bold('  权限确认:'));
        console.log(chalk_1.default.white(`  工具: ${toolDef.name}`));
        console.log(chalk_1.default.dim(`  参数: ${label}`));
        console.log('');
        rl.question(chalk_1.default.cyan('  允许执行? ') + chalk_1.default.dim('(y/n/always) '), (answer) => {
            const a = answer.trim().toLowerCase();
            if (a === 'y' || a === 'yes' || a === '') {
                resolve(true);
            }
            else if (a === 'always') {
                // 设置 yolo 模式
                const { set } = require('./config');
                set('permissionMode', 'yolo');
                logger_1.log.success('已切换为 Yolo 模式，后续操作自动执行');
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
}
function formatToolCall(toolDef, args) {
    switch (toolDef.name) {
        case 'read_file':
            return `读取文件: ${args.path}`;
        case 'write_file':
            return `写入文件: ${args.path}`;
        case 'edit_file':
            return `编辑文件: ${args.path}`;
        case 'run_command':
            return `执行命令: ${args.command}`;
        case 'git_commit':
            return `Git 提交: ${args.message}`;
        default:
            return JSON.stringify(args).slice(0, 100);
    }
}
//# sourceMappingURL=permissions.js.map