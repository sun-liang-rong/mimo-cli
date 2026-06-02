/**
 * 检查命令是否为高危命令
 * @returns 如果安全返回 null，否则返回拦截原因
 */
export declare function checkCommandSafety(cmd: string): string | null;
/**
 * 检查文件路径是否在安全范围内
 * @returns 如果安全返回 null，否则返回拦截原因
 */
export declare function checkPathSafety(filePath: string): string | null;
//# sourceMappingURL=safety.d.ts.map