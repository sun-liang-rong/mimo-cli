import * as fs from 'fs';
import * as path from 'path';
import { ensureMimoDir } from '../utils/paths.js';

export interface TodoItem {
  id: string;
  text: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  createdAt: number;
  completedAt?: number;
  blockedReason?: string;
}

let todoIdCounter = 0;

function getTodoPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.mimo', 'todo.json');
}

export class TodoManager {
  private items: TodoItem[] = [];

  constructor() {
    this.load();
  }

  add(text: string): TodoItem {
    const item: TodoItem = {
      id: `todo_${++todoIdCounter}`,
      text,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.items.push(item);
    this.save();
    return item;
  }

  done(id: string): TodoItem | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.status = 'completed';
    item.completedAt = Date.now();
    this.save();
    return item;
  }

  skip(id: string): TodoItem | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.status = 'skipped';
    this.save();
    return item;
  }

  block(id: string, reason: string): TodoItem | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.status = 'blocked';
    item.blockedReason = reason;
    this.save();
    return item;
  }

  start(id: string): TodoItem | null {
    const item = this.items.find(i => i.id === id);
    if (!item) return null;
    item.status = 'in_progress';
    this.save();
    return item;
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.save();
    return true;
  }

  list(): TodoItem[] {
    return [...this.items];
  }

  getProgress(): { completed: number; total: number; percent: number } {
    const total = this.items.length;
    const completed = this.items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
    return { completed, total, percent: total > 0 ? Math.round(completed / total * 100) : 0 };
  }

  /** Convert plan items to todos */
  importFromPlan(planItems: { id: string; step: string }[]): void {
    for (const pi of planItems) {
      this.add(pi.step);
    }
  }

  clear(): void {
    this.items = [];
    this.save();
  }

  private save(): void {
    ensureMimoDir();
    fs.writeFileSync(getTodoPath(), JSON.stringify(this.items, null, 2));
  }

  private load(): void {
    const todoPath = getTodoPath();
    if (fs.existsSync(todoPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(todoPath, 'utf-8'));
        if (Array.isArray(data)) {
          this.items = data;
          // Update counter to avoid ID conflicts
          const maxNum = this.items.reduce((max, item) => {
            const num = parseInt(item.id.replace('todo_', ''), 10);
            return num > max ? num : max;
          }, 0);
          todoIdCounter = maxNum;
        }
      } catch { this.items = []; }
    }
  }
}
