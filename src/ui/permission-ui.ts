// src/ui/permission-ui.ts

import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { PermissionDecision } from './theme';

const PERMISSION_TIMEOUT_MS = 10000;

export class PermissionUI {
  private chatbox: ChatBox;
  private inputbox: InputBox;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(chatbox: ChatBox, inputbox: InputBox) {
    this.chatbox = chatbox;
    this.inputbox = inputbox;
  }

  /**
   * 请求权限确认
   * 在 ChatBox 内显示确认提示，等待用户通过 InputBox 响应
   */
  requestPermission(toolName: string, detail: string): Promise<PermissionDecision> {
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
      const handler = (decision: PermissionDecision) => {
        this.cleanup();
        resolve(decision);
      };

      this.inputbox.once('permission', handler);
    });
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.inputbox.exitPermissionMode();
  }
}
