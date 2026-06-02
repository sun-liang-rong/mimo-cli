import fs from 'fs';
import path from 'path';

const MEMORY_DIR = '.mimo';
const MEMORY_FILE = 'memory.md';

/**
 * 项目记忆系统
 * 在项目根目录 .mimo/memory.md 中存储项目级记忆
 */
export class ProjectMemory {
  private memoryPath: string;

  constructor(cwd?: string) {
    const projectDir = cwd || process.cwd();
    this.memoryPath = path.join(projectDir, MEMORY_DIR, MEMORY_FILE);
  }

  /** 加载项目记忆 */
  load(): string | null {
    try {
      if (fs.existsSync(this.memoryPath)) {
        return fs.readFileSync(this.memoryPath, 'utf-8');
      }
    } catch {
      // 忽略读取错误
    }
    return null;
  }

  /** 保存项目记忆 */
  save(content: string): void {
    try {
      const dir = path.dirname(this.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.memoryPath, content, 'utf-8');
    } catch {
      // 忽略写入错误
    }
  }

  /** 追加记忆条目 */
  append(entry: string): void {
    const existing = this.load();
    const timestamp = new Date().toISOString().slice(0, 10);
    const newEntry = `\n\n## ${timestamp}\n${entry}`;

    if (existing) {
      this.save(existing + newEntry);
    } else {
      this.save(`# 项目记忆\n${newEntry}`);
    }
  }

  /** 检查是否有记忆文件 */
  exists(): boolean {
    return fs.existsSync(this.memoryPath);
  }

  /** 删除记忆文件 */
  clear(): void {
    try {
      if (fs.existsSync(this.memoryPath)) {
        fs.unlinkSync(this.memoryPath);
      }
    } catch {
      // 忽略
    }
  }
}
