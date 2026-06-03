import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { PermissionDecision } from './theme';
export declare class PermissionUI {
    private chatbox;
    private inputbox;
    private timeoutHandle;
    constructor(chatbox: ChatBox, inputbox: InputBox);
    /**
     * 请求权限确认
     * 在 ChatBox 内显示确认提示，等待用户通过 InputBox 响应
     */
    requestPermission(toolName: string, detail: string): Promise<PermissionDecision>;
    private cleanup;
}
//# sourceMappingURL=permission-ui.d.ts.map