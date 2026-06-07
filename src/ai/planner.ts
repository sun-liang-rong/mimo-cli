import { EventEmitter } from 'events';

export type PlanStatus = 'drafting' | 'confirmed' | 'executing' | 'verifying' | 'done' | 'aborted';

export interface PlanItem {
  id: string;
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
  toolCalls?: string[];
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface Plan {
  id: string;
  title: string;
  items: PlanItem[];
  status: PlanStatus;
  createdAt: number;
  updatedAt: number;
}

let planIdCounter = 0;

export class PlanEngine extends EventEmitter {
  private currentPlan: Plan | null = null;

  createPlan(title: string, steps: string[]): Plan {
    const plan: Plan = {
      id: `plan_${++planIdCounter}`,
      title,
      items: steps.map((step, i) => ({
        id: `step_${i + 1}`,
        step,
        status: 'pending' as const,
      })),
      status: 'drafting',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.currentPlan = plan;
    this.emit('plan_created', { plan });
    return plan;
  }

  confirmPlan(): Plan | null {
    if (!this.currentPlan) return null;
    this.currentPlan.status = 'confirmed';
    this.currentPlan.updatedAt = Date.now();
    this.emit('plan_confirmed', { plan: this.currentPlan });
    return this.currentPlan;
  }

  startExecution(): Plan | null {
    if (!this.currentPlan || this.currentPlan.status !== 'confirmed') return null;
    this.currentPlan.status = 'executing';
    this.currentPlan.updatedAt = Date.now();
    this.emit('plan_executing', { plan: this.currentPlan });
    return this.currentPlan;
  }

  startStep(stepId: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.items.find(i => i.id === stepId);
    if (!item) return;
    item.status = 'in_progress';
    item.startedAt = Date.now();
    this.currentPlan.updatedAt = Date.now();
    this.emit('step_started', { plan: this.currentPlan, item });
  }

  completeStep(stepId: string, result: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.items.find(i => i.id === stepId);
    if (!item) return;
    item.status = 'completed';
    item.result = result;
    item.completedAt = Date.now();
    this.currentPlan.updatedAt = Date.now();

    // Check if all steps completed
    const allDone = this.currentPlan.items.every(i => i.status === 'completed' || i.status === 'skipped' || i.status === 'failed');
    if (allDone) {
      const hasFailed = this.currentPlan.items.some(i => i.status === 'failed');
      this.currentPlan.status = hasFailed ? 'aborted' : 'done';
      this.emit(hasFailed ? 'plan_aborted' : 'plan_done', { plan: this.currentPlan });
    }
    this.emit('step_completed', { plan: this.currentPlan, item });
  }

  failStep(stepId: string, error: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.items.find(i => i.id === stepId);
    if (!item) return;
    item.status = 'failed';
    item.error = error;
    item.completedAt = Date.now();
    this.currentPlan.updatedAt = Date.now();
    this.emit('step_failed', { plan: this.currentPlan, item });
  }

  skipStep(stepId: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.items.find(i => i.id === stepId);
    if (!item) return;
    item.status = 'skipped';
    this.currentPlan.updatedAt = Date.now();
    this.emit('step_skipped', { plan: this.currentPlan, item });
  }

  blockStep(stepId: string, reason: string): void {
    if (!this.currentPlan) return;
    const item = this.currentPlan.items.find(i => i.id === stepId);
    if (!item) return;
    item.status = 'blocked';
    item.error = reason;
    this.currentPlan.updatedAt = Date.now();
    this.emit('step_blocked', { plan: this.currentPlan, item });
  }

  setVerifying(): void {
    if (!this.currentPlan) return;
    this.currentPlan.status = 'verifying';
    this.currentPlan.updatedAt = Date.now();
    this.emit('plan_verifying', { plan: this.currentPlan });
  }

  getPlan(): Plan | null { return this.currentPlan; }

  getProgress(): { completed: number; total: number; percent: number } {
    if (!this.currentPlan) return { completed: 0, total: 0, percent: 0 };
    const total = this.currentPlan.items.length;
    const completed = this.currentPlan.items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
    return { completed, total, percent: total > 0 ? Math.round(completed / total * 100) : 0 };
  }

  clear(): void {
    this.currentPlan = null;
    this.emit('plan_clear', {});
  }

  /** Generate a plan from AI response text by parsing numbered steps */
  parsePlanFromText(text: string, title?: string): Plan | null {
    const lines = text.split('\n');
    const steps: string[] = [];

    // Match numbered steps like "1. xxx", "Step 1: xxx", etc.
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)[.:\s]+(.+)/);
      if (match) {
        steps.push(match[2].trim());
      }
      // Also match bullet steps under a plan section
      if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        const content = trimmed.slice(1).trim();
        if (content.length > 5) steps.push(content);
      }
    }

    if (steps.length === 0) return null;
    return this.createPlan(title || '执行计划', steps);
  }

  /** Serialize plan to JSON for persistence */
  serialize(): string {
    return JSON.stringify(this.currentPlan);
  }

  /** Deserialize plan from JSON */
  deserialize(json: string): Plan | null {
    try {
      this.currentPlan = JSON.parse(json);
      return this.currentPlan;
    } catch {
      return null;
    }
  }
}
