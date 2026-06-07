import * as fs from 'fs';
import * as path from 'path';

export interface CostEntry {
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export type BudgetMode = 'unlimited' | 'soft_limit' | 'hard_limit';

export interface CostConfig {
  budgetPerSession: number;  // in USD, 0 = unlimited
  budgetMode: BudgetMode;
  pricing: Record<string, { input: number; output: number }>;  // per 1M tokens
}

const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  'mimo-v2.5-pro': { input: 0.5, output: 1.5 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-3.5-sonnet': { input: 3, output: 15 },
  'default': { input: 1, output: 3 },
};

export class CostController {
  private entries: CostEntry[] = [];
  private config: CostConfig;
  private softLimitTriggered = false;

  constructor(config?: Partial<CostConfig>) {
    this.config = {
      budgetPerSession: config?.budgetPerSession || 0,
      budgetMode: config?.budgetMode || 'unlimited',
      pricing: { ...DEFAULT_PRICING, ...config?.pricing },
    };
  }

  /** Record a new API call cost */
  record(model: string, inputTokens: number, outputTokens: number): CostEntry {
    const pricing = this.config.pricing[model] || this.config.pricing['default'];
    const estimatedCost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

    const entry: CostEntry = {
      timestamp: Date.now(),
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost,
    };

    this.entries.push(entry);
    this.checkBudget();
    return entry;
  }

  /** Get session total cost */
  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.estimatedCost, 0);
  }

  /** Get session total tokens */
  getTotalTokens(): { input: number; output: number; total: number } {
    return {
      input: this.entries.reduce((sum, e) => sum + e.inputTokens, 0),
      output: this.entries.reduce((sum, e) => sum + e.outputTokens, 0),
      total: this.entries.reduce((sum, e) => sum + e.totalTokens, 0),
    };
  }

  /** Get number of API calls */
  getCallCount(): number {
    return this.entries.length;
  }

  /** Check if budget limits are reached */
  private checkBudget(): void {
    if (this.config.budgetPerSession <= 0) return;
    const total = this.getTotalCost();
    const ratio = total / this.config.budgetPerSession;

    if (this.config.budgetMode === 'soft_limit' && ratio > 0.8 && !this.softLimitTriggered) {
      this.softLimitTriggered = true;
      // Emit event or log — handled by ChatView
    }
  }

  /** Check if we should pause for budget */
  shouldPause(): boolean {
    if (this.config.budgetMode !== 'hard_limit' || this.config.budgetPerSession <= 0) return false;
    return this.getTotalCost() >= this.config.budgetPerSession;
  }

  /** Check if we're in warning zone */
  isWarning(): boolean {
    if (this.config.budgetPerSession <= 0) return false;
    return this.getTotalCost() / this.config.budgetPerSession > 0.8;
  }

  /** Get a cost report string */
  getReport(): string {
    const total = this.getTotalCost();
    const tokens = this.getTotalTokens();
    const calls = this.getCallCount();
    let report = `**成本报告**\n\n`;
    report += `- API 调用次数: ${calls}\n`;
    report += `- 输入 Token: ${tokens.input.toLocaleString()}\n`;
    report += `- 输出 Token: ${tokens.output.toLocaleString()}\n`;
    report += `- 总 Token: ${tokens.total.toLocaleString()}\n`;
    report += `- 估算费用: $${total.toFixed(4)}`;
    if (this.config.budgetPerSession > 0) {
      const percent = Math.round(total / this.config.budgetPerSession * 100);
      report += `\n- 预算使用: ${percent}% ($${total.toFixed(2)} / $${this.config.budgetPerSession.toFixed(2)})`;
    }
    return report;
  }

  /** Get a short status string for StatusBar */
  getStatusString(): string {
    const total = this.getTotalCost();
    if (total < 0.01) return `$0.00`;
    if (total < 1) return `$${total.toFixed(2)}`;
    return `$${total.toFixed(2)}`;
  }

  getConfig(): CostConfig { return this.config; }
  clear(): void { this.entries = []; this.softLimitTriggered = false; }
}
