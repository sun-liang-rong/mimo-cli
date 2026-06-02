"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initLayout = initLayout;
exports.renderTopBar = renderTopBar;
exports.renderFooterBar = renderFooterBar;
exports.setActivityStatus = setActivityStatus;
exports.appendChat = appendChat;
exports.clearChat = clearChat;
exports.refreshTaskPanel = refreshTaskPanel;
exports.startInputLoop = startInputLoop;
exports.continueInputLoop = continueInputLoop;
exports.stopInputLoop = stopInputLoop;
exports.getLayout = getLayout;
exports.refreshAll = refreshAll;
exports.getCurrentTasks = getCurrentTasks;
exports.renderTaskResult = renderTaskResult;
const os_1 = __importDefault(require("os"));
const readline_1 = __importDefault(require("readline"));
const chalk_1 = __importDefault(require("chalk"));
const config_1 = require("../core/config");
const codex_renderer_1 = require("./codex-renderer");
let currentTasks = [];
let activityStatus = 'idle';
let inputCallback = null;
let isRunning = false;
let currentUsage;
let rl = null;
function initLayout() {
    process.stdout.setDefaultEncoding('utf8');
    process.stderr.setDefaultEncoding('utf8');
    const cfg = (0, config_1.getConfig)();
    console.log(chalk_1.default.dim((0, codex_renderer_1.formatHeader)({
        model: cfg.model,
        permissionMode: cfg.permissionMode,
    })));
    console.log(chalk_1.default.dim(`user ${os_1.default.userInfo().username}`));
}
function renderTopBar() {
    const cfg = (0, config_1.getConfig)();
    console.log(chalk_1.default.dim((0, codex_renderer_1.formatHeader)({
        model: cfg.model,
        permissionMode: cfg.permissionMode,
    })));
}
function renderFooterBar(usage) {
    currentUsage = usage;
    if (usage) {
        console.log(chalk_1.default.dim((0, codex_renderer_1.formatStatus)(activityStatus, usage)));
    }
}
function setActivityStatus(status) {
    activityStatus = status;
}
function appendChat(content) {
    if (!content) {
        console.log('');
        return;
    }
    console.log(content);
}
function clearChat() {
    console.clear();
    renderTopBar();
}
function refreshTaskPanel(tasks) {
    currentTasks = tasks;
}
function startInputLoop(callback) {
    inputCallback = callback;
    isRunning = true;
    rl = readline_1.default.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        prompt: chalk_1.default.green((0, codex_renderer_1.formatPrompt)()),
    });
    rl.on('line', (value) => {
        if (!isRunning || !inputCallback)
            return;
        rl?.pause();
        inputCallback(value.trim());
    });
    rl.on('SIGINT', () => {
        stopInputLoop();
        process.exit(0);
    });
    rl.prompt();
}
function continueInputLoop() {
    if (!rl || !isRunning)
        return;
    rl.resume();
    rl.prompt();
}
function stopInputLoop() {
    isRunning = false;
    inputCallback = null;
    rl?.close();
    rl = null;
}
function getLayout() {
    return {
        screen: null,
        chatBox: null,
        taskPanel: null,
        inputLine: null,
    };
}
function refreshAll(usage) {
    renderFooterBar(usage);
}
function getCurrentTasks() {
    return currentTasks;
}
function renderTaskResult(name, success) {
    appendChat(chalk_1.default.dim((0, codex_renderer_1.formatToolResult)(name, success)));
}
//# sourceMappingURL=layout.js.map