import * as fs from 'fs';
import * as path from 'path';
import { ensureMimoDir } from '../utils/paths.js';
import { getErrorMessage } from '../utils/errors.js';

export interface MemoryEntry {
  key: string;
  value: string;
  scope: 'project' | 'session' | 'working';
  createdAt: number;
  updatedAt: number;
}

function getMemoryPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.mimo', 'memory.json');
}

export class MemoryManager {
  private entries: Map<string, MemoryEntry> = new Map();
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.load();
  }

  /** Store a memory entry */
  set(key: string, value: string, scope: MemoryEntry['scope'] = 'session'): void {
    const existing = this.entries.get(key);
    const now = Date.now();
    this.entries.set(key, {
      key,
      value,
      scope,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    });
    this.save();
  }

  /** Retrieve a memory entry */
  get(key: string): string | undefined {
    return this.entries.get(key)?.value;
  }

  /** Delete a memory entry */
  delete(key: string): boolean {
    const result = this.entries.delete(key);
    if (result) this.save();
    return result;
  }

  /** List all entries, optionally filtered by scope */
  list(scope?: MemoryEntry['scope']): MemoryEntry[] {
    const entries = Array.from(this.entries.values());
    if (scope) return entries.filter(e => e.scope === scope);
    return entries;
  }

  /** Get project-level memories as context string for system prompt */
  getProjectContext(): string {
    const projectEntries = this.list('project');
    if (projectEntries.length === 0) return '';
    let ctx = '## 项目记忆\n';
    for (const entry of projectEntries) {
      ctx += `- **${entry.key}**: ${entry.value}\n`;
    }
    return ctx;
  }

  /** Get session-level memories as context string */
  getSessionContext(): string {
    const sessionEntries = this.list('session');
    if (sessionEntries.length === 0) return '';
    let ctx = '## 会话记忆\n';
    for (const entry of sessionEntries) {
      ctx += `- **${entry.key}**: ${entry.value}\n`;
    }
    return ctx;
  }

  /** Get all memories as context for AI (compressed) */
  getAllContext(maxTokens = 800): string {
    const all = this.list();
    if (all.length === 0) return '';
    let ctx = '## 记忆\n';
    let tokenEstimate = 0;
    for (const entry of all) {
      const line = `- [${entry.scope}] **${entry.key}**: ${entry.value}\n`;
      tokenEstimate += Math.ceil(line.length * 0.3);
      if (tokenEstimate > maxTokens) {
        ctx += `- ... (还有 ${all.length - all.indexOf(entry)} 条记忆已省略)\n`;
        break;
      }
      ctx += line;
    }
    return ctx;
  }

  /** Clear working memories (short-term, not persisted across sessions) */
  clearWorking(): void {
    for (const [key, entry] of this.entries) {
      if (entry.scope === 'working') this.entries.delete(key);
    }
    this.save();
  }

  /** Clear session memories */
  clearSession(): void {
    for (const [key, entry] of this.entries) {
      if (entry.scope === 'session') this.entries.delete(key);
    }
    this.save();
  }

  /** Clear all memories */
  clearAll(): void {
    this.entries.clear();
    this.save();
  }

  /** Auto-extract key facts from a conversation turn and store them */
  extractAndStore(role: string, content: string): void {
    if (!content || content.length < 20) return;

    // Auto-detect and store file modifications
    const fileModMatch = content.match(/(?:修改|编辑|创建|写入|已编辑|已写入|已).*?[:：]\s*`?([^\s`]+\.\w+)`?/);
    if (fileModMatch) {
      this.set(`last_modified:${fileModMatch[1]}`, new Date().toISOString(), 'session');
    }

    // Auto-detect error patterns
    const errorMatch = content.match(/(?:错误|失败|Error|Failed)[:：]\s*(.+)/);
    if (errorMatch) {
      this.set(`last_error`, errorMatch[1].slice(0, 200), 'working');
    }
  }

  private save(): void {
    ensureMimoDir();
    const data = Array.from(this.entries.values());
    fs.writeFileSync(getMemoryPath(), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const memPath = getMemoryPath();
    if (fs.existsSync(memPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
        if (Array.isArray(data)) {
          for (const entry of data) {
            this.entries.set(entry.key, entry);
          }
        }
      } catch { /* ignore */ }
    }
  }
}
