import blessed from 'blessed';
export interface TuiComponents {
    screen: blessed.Widgets.Screen;
    topBar: blessed.Widgets.BoxElement;
    chatBox: blessed.Widgets.Log;
    taskPanel: blessed.Widgets.BoxElement;
    inputBox: blessed.Widgets.TextboxElement;
    footerBar: blessed.Widgets.BoxElement;
}
export declare function initTui(): TuiComponents;
export declare function getTui(): TuiComponents | null;
//# sourceMappingURL=tui.d.ts.map