export interface MultiEditArgs {
    edits: Array<{
        path: string;
        old_string: string;
        new_string: string;
    }>;
}
export declare function registerMultiEditTool(): void;
//# sourceMappingURL=multi-edit.d.ts.map