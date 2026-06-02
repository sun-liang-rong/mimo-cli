"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectMemory = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MEMORY_DIR = '.mimo';
const MEMORY_FILE = 'memory.md';
/**
 * 项目记忆系统
 * 在项目根目录 .mimo/memory.md 中存储项目级记忆
 */
class ProjectMemory {
    memoryPath;
    constructor(cwd) {
        const projectDir = cwd || process.cwd();
        this.memoryPath = path_1.default.join(projectDir, MEMORY_DIR, MEMORY_FILE);
    }
    /** 加载项目记忆 */
    load() {
        try {
            if (fs_1.default.existsSync(this.memoryPath)) {
                return fs_1.default.readFileSync(this.memoryPath, 'utf-8');
            }
        }
        catch {
            // 忽略读取错误
        }
        return null;
    }
    /** 保存项目记忆 */
    save(content) {
        try {
            const dir = path_1.default.dirname(this.memoryPath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(this.memoryPath, content, 'utf-8');
        }
        catch {
            // 忽略写入错误
        }
    }
    /** 追加记忆条目 */
    append(entry) {
        const existing = this.load();
        const timestamp = new Date().toISOString().slice(0, 10);
        const newEntry = `\n\n## ${timestamp}\n${entry}`;
        if (existing) {
            this.save(existing + newEntry);
        }
        else {
            this.save(`# 项目记忆\n${newEntry}`);
        }
    }
    /** 检查是否有记忆文件 */
    exists() {
        return fs_1.default.existsSync(this.memoryPath);
    }
    /** 删除记忆文件 */
    clear() {
        try {
            if (fs_1.default.existsSync(this.memoryPath)) {
                fs_1.default.unlinkSync(this.memoryPath);
            }
        }
        catch {
            // 忽略
        }
    }
}
exports.ProjectMemory = ProjectMemory;
//# sourceMappingURL=memory.js.map