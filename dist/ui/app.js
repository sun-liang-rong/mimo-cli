"use strict";
// src/ui/app.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TUIApp = void 0;
const blessed_1 = __importDefault(require("blessed"));
const events_1 = require("events");
const os_1 = __importDefault(require("os"));
const topbar_1 = require("./topbar");
const footerbar_1 = require("./footerbar");
const chatbox_1 = require("./chatbox");
const inputbox_1 = require("./inputbox");
const stream_renderer_1 = require("./stream-renderer");
const permission_ui_1 = require("./permission-ui");
class TUIApp extends events_1.EventEmitter {
    screen;
    topbar;
    footerbar;
    chatbox;
    inputbox;
    streamRenderer;
    permissionUI;
    options;
    constructor(options) {
        super();
        this.options = options;
        // 创建 blessed Screen
        this.screen = blessed_1.default.screen({
            smartCSR: true,
            title: 'MiMo CLI',
            fullUnicode: true,
            dockBorders: true,
        });
        // 创建组件
        this.topbar = new topbar_1.TopBar(this.screen);
        this.footerbar = new footerbar_1.FooterBar(this.screen);
        this.chatbox = new chatbox_1.ChatBox(this.screen);
        this.inputbox = new inputbox_1.InputBox({ screen: this.screen });
        this.streamRenderer = new stream_renderer_1.StreamRenderer(this.chatbox, this.footerbar, this.screen);
        this.permissionUI = new permission_ui_1.PermissionUI(this.chatbox, this.inputbox);
        // 初始化 TopBar
        this.topbar.update({
            model: options.model,
            permissionMode: options.permissionMode,
            version: options.version,
        });
        // 初始化 FooterBar
        this.footerbar.updateInfo(options.model, options.permissionMode);
        // 绑定事件
        this.bindEvents();
    }
    /** 启动 TUI */
    start() {
        // 显示欢迎信息
        const username = os_1.default.userInfo().username;
        this.chatbox.pushText('{cyan-fg}{bold}MiMo CLI{/bold}{/cyan-fg}');
        this.chatbox.pushText(`{gray-fg}Welcome, ${username}. Type a message to start.{/gray-fg}`);
        this.chatbox.pushText('{gray-fg}/help for commands{/gray-fg}');
        this.chatbox.pushText('');
        // 激活输入
        this.inputbox.activate();
        this.screen.render();
    }
    /** 停止 TUI */
    stop() {
        this.inputbox.deactivate();
        this.screen.destroy();
    }
    /** 获取 StreamRenderer (供 chat.ts 使用) */
    getStreamRenderer() {
        return this.streamRenderer;
    }
    /** 获取 ChatBox */
    getChatBox() {
        return this.chatbox;
    }
    /** 获取 InputBox */
    getInputBox() {
        return this.inputbox;
    }
    /** 获取 FooterBar */
    getFooterBar() {
        return this.footerbar;
    }
    /** 获取 PermissionUI */
    getPermissionUI() {
        return this.permissionUI;
    }
    /** 更新 TopBar 状态 */
    updateTopBar(state) {
        this.topbar.update(state);
    }
    /** 绑定事件 */
    bindEvents() {
        // 输入提交
        this.inputbox.on('submit', (text) => {
            this.emit('input', text);
        });
        // 退出
        this.inputbox.on('quit', () => {
            this.emit('quit');
        });
        // 清屏
        this.inputbox.on('clear', () => {
            this.chatbox.clear();
            this.emit('clear');
        });
        // 取消
        this.inputbox.on('cancel', () => {
            this.emit('cancel');
        });
        // Tab 补全
        this.inputbox.on('tabComplete', (partial) => {
            this.emit('tabComplete', partial);
        });
        // 全局 Ctrl+C (备用)
        this.screen.key(['C-c'], () => {
            this.emit('quit');
        });
    }
}
exports.TUIApp = TUIApp;
//# sourceMappingURL=app.js.map