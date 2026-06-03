import blessed from 'blessed';
export interface TopBarState {
    model: string;
    permissionMode: string;
    version: string;
}
export declare class TopBar {
    readonly box: blessed.Widgets.BoxElement;
    constructor(screen: blessed.Widgets.Screen);
    update(state: TopBarState): void;
}
//# sourceMappingURL=topbar.d.ts.map