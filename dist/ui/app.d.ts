import { EventEmitter } from 'events';
import { TopBarState } from './topbar';
import { FooterBar } from './footerbar';
import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { StreamRenderer } from './stream-renderer';
import { PermissionUI } from './permission-ui';
export interface TUIAppOptions {
    model: string;
    permissionMode: string;
    version: string;
}
export declare class TUIApp extends EventEmitter {
    private screen;
    private topbar;
    private footerbar;
    private chatbox;
    private inputbox;
    private streamRenderer;
    private permissionUI;
    private options;
    constructor(options: TUIAppOptions);
    /** 启动 TUI */
    start(): void;
    /** 停止 TUI */
    stop(): void;
    /** 获取 StreamRenderer (供 chat.ts 使用) */
    getStreamRenderer(): StreamRenderer;
    /** 获取 ChatBox */
    getChatBox(): ChatBox;
    /** 获取 InputBox */
    getInputBox(): InputBox;
    /** 获取 FooterBar */
    getFooterBar(): FooterBar;
    /** 获取 PermissionUI */
    getPermissionUI(): PermissionUI;
    /** 更新 TopBar 状态 */
    updateTopBar(state: TopBarState): void;
    /** 绑定事件 */
    private bindEvents;
}
//# sourceMappingURL=app.d.ts.map