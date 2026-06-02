import { ToolResult } from './registry';
export interface ViewArgs {
    path: string;
    view_range?: [number, number];
}
export declare function handleView(args: Record<string, unknown>): ToolResult;
export declare function registerViewTool(): void;
//# sourceMappingURL=view.d.ts.map