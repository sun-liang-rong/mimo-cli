/**
 * 项目记忆系统
 * 在项目根目录 .mimo/memory.md 中存储项目级记忆
 */
export declare class ProjectMemory {
    private memoryPath;
    constructor(cwd?: string);
    /** 加载项目记忆 */
    load(): string | null;
    /** 保存项目记忆 */
    save(content: string): void;
    /** 追加记忆条目 */
    append(entry: string): void;
    /** 检查是否有记忆文件 */
    exists(): boolean;
    /** 删除记忆文件 */
    clear(): void;
}
//# sourceMappingURL=memory.d.ts.map