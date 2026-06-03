"use strict";
// src/ui/permission-ui.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionUI = void 0;
const PERMISSION_TIMEOUT_MS = 10000;
class PermissionUI {
    chatbox;
    inputbox;
    timeoutHandle = null;
    constructor(chatbox, inputbox) {
        this.chatbox = chatbox;
        this.inputbox = inputbox;
    }
    /**
     * 请求权限确认
     * 在 ChatBox 内显示确认提示，等待用户通过 InputBox 响应
     */
    requestPermission(toolName, detail) {
        return new Promise((resolve) => {
            // 在 ChatBox 内显示确认提示
            this.chatbox.pushPermissionPrompt(toolName, detail);
            // 切换 InputBox 到权限模式
            this.inputbox.enterPermissionMode();
            // 设置超时
            this.timeoutHandle = setTimeout(() => {
                this.cleanup();
                resolve('deny');
            }, PERMISSION_TIMEOUT_MS);
            // 监听权限决策
            const handler = (decision) => {
                this.cleanup();
                resolve(decision);
            };
            this.inputbox.once('permission', handler);
        });
    }
    cleanup() {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
        this.inputbox.exitPermissionMode();
    }
}
exports.PermissionUI = PermissionUI;
//# sourceMappingURL=permission-ui.js.map