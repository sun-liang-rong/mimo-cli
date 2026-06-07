import * as fs from 'fs';
import * as path from 'path';
import { ApproveMode } from '../config/settings.js';
import { ensureMimoDir } from '../utils/paths.js';

export type PermissionLevel = 'safe' | 'confirm' | 'dangerous';

const DEFAULT_PERMISSIONS: Record<string, PermissionLevel> = {
  read_file: 'safe',
  list_files: 'safe',
  search_files: 'safe',
  git_status: 'safe',
  git_diff: 'safe',
  git_log: 'safe',
  save_memory: 'safe',
  query_graph: 'safe',
  get_context: 'safe',
  write_file: 'confirm',
  edit_file: 'confirm',
  execute_command: 'confirm',
  git_commit: 'confirm',
  git_stage: 'confirm',
  git_branch: 'confirm',
  git_push: 'dangerous',
  git_stash: 'safe',
  git_revert: 'dangerous',
  apply_patch: 'confirm',
  spawn_subtask: 'confirm',
};

const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+(-[a-zA-Z]*f|--force)\b/,
  /\brm\s+-rf\b/,
  /\bgit\s+push\b.*--force/,
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bsudo\s+rm\b/,
  /\bchmod\s+777\b/,
  /\bcurl\b.*\|\s*(ba)?sh\b/,
  /\bwget\b.*\|\s*(ba)?sh\b/,
  /\bsudo\s+/,
];

function getAuditLogPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.mimo', 'audit.log');
}

export class PermissionManager {
  private autoApprove: Set<string>;
  private mode: ApproveMode;
  private batchApproveAll = false;

  constructor(autoApprove: string[] = [], mode: ApproveMode = 'smart') {
    this.autoApprove = new Set(autoApprove);
    this.mode = mode;
  }

  setMode(mode: ApproveMode): void {
    this.mode = mode;
  }

  getMode(): ApproveMode {
    return this.mode;
  }

  /** Enable batch approve — all subsequent confirm-level calls auto-approved */
  enableBatchApprove(): void {
    this.batchApproveAll = true;
  }

  disableBatchApprove(): void {
    this.batchApproveAll = false;
  }

  isBatchApproveEnabled(): boolean {
    return this.batchApproveAll;
  }

  getPermissionLevel(toolName: string, args: Record<string, unknown>): PermissionLevel {
    // auto-approve mode: everything is safe
    if (this.mode === 'auto') return 'safe';
    if (this.autoApprove.has(toolName)) return 'safe';

    const level = DEFAULT_PERMISSIONS[toolName] || 'confirm';

    if (toolName === 'execute_command' && args.command) {
      const command = String(args.command);
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) return 'dangerous';
      }
    }

    // smart mode: confirm-level becomes safe if batch approve is on
    if (this.mode === 'smart' && this.batchApproveAll && level === 'confirm') return 'safe';

    // confirm-all mode: everything except safe needs confirmation
    if (this.mode === 'confirm-all' && level !== 'safe') return 'confirm';

    return level;
  }

  shouldAskConfirm(toolName: string, args: Record<string, unknown>): boolean {
    if (this.mode === 'auto') return false;
    const level = this.getPermissionLevel(toolName, args);
    return level !== 'safe';
  }

  isAutoApproved(toolName: string): boolean {
    return this.autoApprove.has(toolName);
  }

  /** Write audit log entry */
  audit(toolName: string, args: Record<string, unknown>, approved: boolean, reason?: string): void {
    ensureMimoDir();
    const entry = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      argsSummary: Object.entries(args).map(([k, v]) => `${k}=${typeof v === 'string' ? v.slice(0, 50) : JSON.stringify(v).slice(0, 50)}`).join(', '),
      approved,
      reason: reason || (approved ? '用户批准' : '用户拒绝'),
      mode: this.mode,
    };
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(getAuditLogPath(), line);
  }

  /** Get recent audit entries */
  getAuditLog(count = 20): string[] {
    const auditPath = getAuditLogPath();
    if (!fs.existsSync(auditPath)) return [];
    try {
      const lines = fs.readFileSync(auditPath, 'utf-8').split('\n').filter(l => l.trim());
      return lines.slice(-count);
    } catch {
      return [];
    }
  }
}
