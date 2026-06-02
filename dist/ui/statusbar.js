"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderStatusBar = renderStatusBar;
exports.renderFooterBar = renderFooterBar;
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../core/config");
/** 渲染顶部状态栏 */
function renderStatusBar() {
    const cfg = (0, config_1.getConfig)();
    const mode = cfg.permissionMode.toUpperCase();
    const parts = [
        chalk_1.default.bgCyan.black(` ${mode} `),
        chalk_1.default.white('·'),
        chalk_1.default.green(cfg.model),
        chalk_1.default.white('·'),
        chalk_1.default.dim(`max ${cfg.maxTokens}`),
        chalk_1.default.white('·'),
        chalk_1.default.dim('v1.0.0'),
    ];
    return parts.join(' ');
}
/** 渲染底部状态栏 */
function renderFooterBar(usage) {
    const cfg = (0, config_1.getConfig)();
    const parts = [
        chalk_1.default.cyan(cfg.permissionMode),
        chalk_1.default.white('·'),
        chalk_1.default.green(cfg.model),
    ];
    if (usage) {
        parts.push(chalk_1.default.white('·'));
        parts.push(chalk_1.default.yellow(`$${((usage.total_tokens / 1000) * 0.002).toFixed(4)}`));
    }
    parts.push(chalk_1.default.dim('·'));
    parts.push(chalk_1.default.dim('Ctrl+C 退出'));
    return parts.join(' ');
}
//# sourceMappingURL=statusbar.js.map