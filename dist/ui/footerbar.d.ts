import blessed from 'blessed';
import { FooterState } from './theme';
export declare class FooterBar {
    readonly box: blessed.Widgets.BoxElement;
    private state;
    private detail;
    private model;
    private permissionMode;
    private tokenCount;
    private elapsedMs;
    constructor(screen: blessed.Widgets.Screen);
    /** 更新基础信息 */
    updateInfo(model: string, permissionMode: string): void;
    setState(state: FooterState, detail?: string): void;
    updateTokenCount(count: number): void;
    updateElapsedTime(ms: number): void;
    private render;
    private formatState;
    private getStateColor;
    private formatElapsed;
    private formatTokens;
}
//# sourceMappingURL=footerbar.d.ts.map