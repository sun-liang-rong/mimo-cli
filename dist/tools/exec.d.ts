export declare function registerExecTools(): void;
export interface ExecResult {
    success: boolean;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
    error?: string;
}
export declare function executeCommand(cmd: string): ExecResult;
//# sourceMappingURL=exec.d.ts.map