"use strict";
// src/ui/inputbox.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputBox = void 0;
const blessed_1 = __importDefault(require("blessed"));
const events_1 = require("events");
const theme_1 = require("./theme");
const MAX_HISTORY = 100;
class InputBox extends events_1.EventEmitter {
    box;
    screen;
    content = '';
    cursorPos = 0;
    placeholder;
    history = [];
    historyIndex = -1;
    active = false;
    waitingPermission = false;
    constructor(options) {
        super();
        this.screen = options.screen;
        this.placeholder = options.placeholder || `${theme_1.Icons.prompt}Type a message or use / for commands...`;
        this.box = blessed_1.default.box({
            parent: options.screen,
            bottom: 1,
            left: 0,
            width: '100%',
            height: 3,
            style: {
                fg: 'white',
                bg: '#1a1a2e',
            },
            tags: true,
        });
        this.renderInput();
    }
    /** 激活输入 (开始监听按键) */
    activate() {
        if (this.active)
            return;
        this.active = true;
        this.screen.program.on('keypress', this.handleKeypress);
        this.screen.render();
    }
    /** 停用输入 */
    deactivate() {
        this.active = false;
        this.screen.program.removeListener('keypress', this.handleKeypress);
    }
    /** 获取当前输入内容 */
    getValue() {
        return this.content;
    }
    /** 清空输入 */
    clear() {
        this.content = '';
        this.cursorPos = 0;
        this.historyIndex = -1;
        this.renderInput();
    }
    /** 设置占位提示 */
    setPlaceholder(text) {
        this.placeholder = text;
        this.renderInput();
    }
    /** 进入权限确认模式 */
    enterPermissionMode() {
        this.waitingPermission = true;
        this.setPlaceholder('y = 允许  n = 拒绝  a = 始终允许');
    }
    /** 退出权限确认模式 */
    exitPermissionMode() {
        this.waitingPermission = false;
        this.setPlaceholder(`${theme_1.Icons.prompt}Type a message or use / for commands...`);
    }
    /** 添加到历史 */
    addToHistory(text) {
        if (!text.trim())
            return;
        // 相邻去重
        if (this.history.length > 0 && this.history[this.history.length - 1] === text)
            return;
        this.history.push(text);
        if (this.history.length > MAX_HISTORY) {
            this.history.shift();
        }
    }
    /** 按键处理 */
    handleKeypress = (ch, key) => {
        if (!this.active)
            return;
        // 权限确认模式: 只接受 y/n/a
        if (this.waitingPermission) {
            if (ch === 'y' || ch === 'Y') {
                this.emit('permission', 'allow');
                this.exitPermissionMode();
            }
            else if (ch === 'n' || ch === 'N') {
                this.emit('permission', 'deny');
                this.exitPermissionMode();
            }
            else if (ch === 'a' || ch === 'A') {
                this.emit('permission', 'always');
                this.exitPermissionMode();
            }
            return;
        }
        const name = key?.name || '';
        const shift = key?.shift || false;
        const ctrl = key?.ctrl || false;
        const meta = key?.meta || false;
        // Ctrl+C: 有内容清空，无内容退出
        if (ctrl && name === 'c') {
            if (this.content.length > 0) {
                this.clear();
            }
            else {
                this.emit('quit');
            }
            return;
        }
        // Ctrl+L: 清屏
        if (ctrl && name === 'l') {
            this.emit('clear');
            return;
        }
        // Ctrl+J: 换行 (备选)
        if (ctrl && name === 'j') {
            this.insertChar('\n');
            return;
        }
        // Escape: 取消
        if (name === 'escape') {
            this.emit('cancel');
            return;
        }
        // Enter / Return
        if (name === 'enter' || name === 'return') {
            if (shift) {
                // Shift+Enter: 换行
                this.insertChar('\n');
            }
            else {
                // Enter: 发送
                const text = this.content;
                if (text.trim()) {
                    this.addToHistory(text);
                    this.clear();
                    this.emit('submit', text);
                }
            }
            return;
        }
        // 上下箭头: 历史 (仅在内容为空或光标在开头时)
        if (name === 'up') {
            if (this.history.length > 0) {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                }
                this.content = this.history[this.history.length - 1 - this.historyIndex];
                this.cursorPos = this.content.length;
                this.renderInput();
            }
            return;
        }
        if (name === 'down') {
            if (this.historyIndex > 0) {
                this.historyIndex--;
                this.content = this.history[this.history.length - 1 - this.historyIndex];
            }
            else {
                this.historyIndex = -1;
                this.content = '';
            }
            this.cursorPos = this.content.length;
            this.renderInput();
            return;
        }
        // Backspace
        if (name === 'backspace') {
            if (this.cursorPos > 0) {
                this.content = this.content.slice(0, this.cursorPos - 1) + this.content.slice(this.cursorPos);
                this.cursorPos--;
                this.renderInput();
            }
            return;
        }
        // Delete
        if (name === 'delete') {
            if (this.cursorPos < this.content.length) {
                this.content = this.content.slice(0, this.cursorPos) + this.content.slice(this.cursorPos + 1);
                this.renderInput();
            }
            return;
        }
        // 左右箭头
        if (name === 'left') {
            if (this.cursorPos > 0) {
                this.cursorPos--;
                this.renderInput();
            }
            return;
        }
        if (name === 'right') {
            if (this.cursorPos < this.content.length) {
                this.cursorPos++;
                this.renderInput();
            }
            return;
        }
        // Tab: 补全
        if (name === 'tab') {
            this.emit('tabComplete', this.content);
            return;
        }
        // Home
        if (name === 'home') {
            this.cursorPos = 0;
            this.renderInput();
            return;
        }
        // End
        if (name === 'end') {
            this.cursorPos = this.content.length;
            this.renderInput();
            return;
        }
        // 普通字符输入
        if (ch && !ctrl && !meta && ch.length === 1) {
            this.insertChar(ch);
        }
    };
    /** 在光标位置插入字符 */
    insertChar(ch) {
        this.content = this.content.slice(0, this.cursorPos) + ch + this.content.slice(this.cursorPos);
        this.cursorPos += ch.length;
        this.renderInput();
    }
    /** 渲染输入框 */
    renderInput() {
        const displayContent = this.content || '';
        const lines = displayContent.split('\n');
        // 自适应高度 (1-3 行)
        const contentLines = Math.max(1, Math.min(3, lines.length));
        this.box.height = contentLines + 1; // +1 for padding
        if (displayContent) {
            // 显示实际内容
            const promptLine = `{${theme_1.Colors.user}-fg}${theme_1.Icons.prompt}{/fg}`;
            const rendered = lines
                .map((line, i) => i === 0 ? `${promptLine}${line}` : `  ${line}`)
                .join('\n');
            this.box.setContent(rendered);
        }
        else {
            // 显示占位提示
            this.box.setContent(`{${theme_1.Colors.dim}-fg}${this.placeholder}{/fg}`);
        }
        this.screen.render();
    }
}
exports.InputBox = InputBox;
//# sourceMappingURL=inputbox.js.map