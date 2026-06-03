import blessed from 'blessed';
import { EventEmitter } from 'events';
export interface InputBoxOptions {
    screen: blessed.Widgets.Screen;
    placeholder?: string;
}
export declare class InputBox extends EventEmitter {
    readonly box: blessed.Widgets.BoxElement;
    private screen;
    private content;
    private cursorPos;
    private placeholder;
    private history;
    private historyIndex;
    private active;
    private waitingPermission;
    constructor(options: InputBoxOptions);
    /** 激活输入 (开始监听按键) */
    activate(): void;
    /** 停用输入 */
    deactivate(): void;
    /** 获取当前输入内容 */
    getValue(): string;
    /** 清空输入 */
    clear(): void;
    /** 设置占位提示 */
    setPlaceholder(text: string): void;
    /** 进入权限确认模式 */
    enterPermissionMode(): void;
    /** 退出权限确认模式 */
    exitPermissionMode(): void;
    /** 添加到历史 */
    private addToHistory;
    /** 按键处理 */
    private handleKeypress;
    /** 在光标位置插入字符 */
    private insertChar;
    /** 渲染输入框 */
    private renderInput;
}
//# sourceMappingURL=inputbox.d.ts.map