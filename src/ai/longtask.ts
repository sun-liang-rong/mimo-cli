import * as fs from 'fs';
import * as path from 'path';
import { Plan, PlanItem } from './planner.js';
import { ensureMimoDir } from '../utils/paths.js';

export interface LongTaskProgress {
  planId: string;
  title: string;
  totalSteps: number;
  completedSteps: number;
  currentStepIndex: number;
  currentStepDescription: string;
  startedAt: number;
  lastUpdatedAt: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
}

function getProgressPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.mimo', 'progress.json');
}

export class LongTaskRunner {
  private progress: LongTaskProgress | null = null;

  /** Start tracking a long task from a plan */
  startFromPlan(plan: Plan): LongTaskProgress {
    const completedSteps = plan.items.filter(i => i.status === 'completed' || i.status === 'skipped').length;
    const currentStep = plan.items.find(i => i.status === 'in_progress');

    this.progress = {
      planId: plan.id,
      title: plan.title,
      totalSteps: plan.items.length,
      completedSteps,
      currentStepIndex: currentStep ? plan.items.indexOf(currentStep) : completedSteps,
      currentStepDescription: currentStep?.step || '',
      startedAt: plan.createdAt,
      lastUpdatedAt: Date.now(),
      status: 'running',
    };

    this.save();
    return this.progress;
  }

  /** Update progress */
  updateStep(stepIndex: number, description: string, completedSteps: number): void {
    if (!this.progress) return;
    this.progress.currentStepIndex = stepIndex;
    this.progress.currentStepDescription = description;
    this.progress.completedSteps = completedSteps;
    this.progress.lastUpdatedAt = Date.now();
    this.save();
  }

  /** Mark task as paused */
  pause(): void {
    if (!this.progress) return;
    this.progress.status = 'paused';
    this.progress.lastUpdatedAt = Date.now();
    this.save();
  }

  /** Mark task as completed */
  complete(): void {
    if (!this.progress) return;
    this.progress.status = 'completed';
    this.progress.completedSteps = this.progress.totalSteps;
    this.progress.lastUpdatedAt = Date.now();
    this.save();
  }

  /** Mark task as failed */
  fail(): void {
    if (!this.progress) return;
    this.progress.status = 'failed';
    this.progress.lastUpdatedAt = Date.now();
    this.save();
  }

  /** Get current progress */
  getProgress(): LongTaskProgress | null {
    return this.progress;
  }

  /** Get progress percent */
  getPercent(): number {
    if (!this.progress || this.progress.totalSteps === 0) return 0;
    return Math.round(this.progress.completedSteps / this.progress.totalSteps * 100);
  }

  /** Check if a plan qualifies as a long task */
  static isLongTask(plan: Plan): boolean {
    return plan.items.length > 5;
  }

  /** Load previously saved progress for resume */
  loadProgress(): LongTaskProgress | null {
    const progressPath = getProgressPath();
    if (!fs.existsSync(progressPath)) return null;
    try {
      this.progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      return this.progress;
    } catch {
      return null;
    }
  }

  /** Get a status string for display */
  getStatusString(): string {
    if (!this.progress) return '';
    const p = this.progress;
    const percent = this.getPercent();
    const elapsed = Math.round((Date.now() - p.startedAt) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return `${p.title}: ${percent}% (${p.completedSteps}/${p.totalSteps}) ${mins}m${secs}s`;
  }

  private save(): void {
    ensureMimoDir();
    if (this.progress) {
      fs.writeFileSync(getProgressPath(), JSON.stringify(this.progress, null, 2));
    }
  }

  clear(): void {
    this.progress = null;
    const progressPath = getProgressPath();
    if (fs.existsSync(progressPath)) fs.unlinkSync(progressPath);
  }
}
