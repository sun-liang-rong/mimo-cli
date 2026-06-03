"use strict";
// src/ui/footerbar.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FooterBar = void 0;
const blessed_1 = __importDefault(require("blessed"));
const theme_1 = require("./theme");
class FooterBar {
    box;
    state = 'idle';
    detail = '';
    model = '';
    permissionMode = 'default';
    tokenCount = 0;
    elapsedMs = 0;
    constructor(screen) {
        this.box = blessed_1.default.box({
            parent: screen,
            bottom: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: '',
            style: {
                fg: theme_1.Colors.footerBarFg,
                bg: theme_1.Colors.footerBarBg,
            },
            tags: true,
        });
    }
    /** 更新基础信息 */
    updateInfo(model, permissionMode) {
        this.model = model;
        this.permissionMode = permissionMode;
        this.render();
    }
    setState(state, detail) {
        this.state = state;
        this.detail = detail || '';
        this.render();
    }
    updateTokenCount(count) {
        this.tokenCount = count;
        this.render();
    }
    updateElapsedTime(ms) {
        this.elapsedMs = ms;
        this.render();
    }
    render() {
        const stateDisplay = this.formatState();
        const stateColor = this.getStateColor();
        const parts = [
            `{${stateColor}-fg}${this.permissionMode}{/fg}`,
            '·',
            `{${stateColor}-fg}${this.model}{/fg}`,
            '·',
            `{${stateColor}-fg}${stateDisplay}{/fg}`,
        ];
        if (this.tokenCount > 0 && this.state === 'streaming') {
            parts.push('·');
            parts.push(`{gray-fg}${this.formatTokens()}{/fg}`);
        }
        parts.push('·');
        parts.push('{gray-fg}Ctrl+C quit{/fg}');
        this.box.setContent(parts.join(' '));
        this.box.screen.render();
    }
    formatState() {
        switch (this.state) {
            case 'idle':
                return 'idle';
            case 'thinking':
                return `${theme_1.Icons.statusThinking} thinking ${this.formatElapsed()}`;
            case 'streaming':
                return `${theme_1.Icons.statusStreaming} streaming ${this.formatTokens()}`;
            case 'tool_call':
                return `${theme_1.Icons.statusToolCall} ${this.detail} ${this.formatElapsed()}`;
            case 'waiting_input':
                return `${theme_1.Icons.statusWaitingInput} permission y/n/a`;
        }
    }
    getStateColor() {
        switch (this.state) {
            case 'idle':
                return theme_1.Colors.statusIdle;
            case 'thinking':
                return theme_1.Colors.statusThinking;
            case 'streaming':
                return theme_1.Colors.statusStreaming;
            case 'tool_call':
                return theme_1.Colors.statusToolCall;
            case 'waiting_input':
                return theme_1.Colors.statusWaitingInput;
        }
    }
    formatElapsed() {
        if (this.elapsedMs === 0)
            return '';
        return `${(this.elapsedMs / 1000).toFixed(1)}s`;
    }
    formatTokens() {
        if (this.tokenCount < 1000)
            return `${this.tokenCount} tokens`;
        return `${(this.tokenCount / 1000).toFixed(1)}k tokens`;
    }
}
exports.FooterBar = FooterBar;
//# sourceMappingURL=footerbar.js.map