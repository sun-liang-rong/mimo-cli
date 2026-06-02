import fs from 'fs';
import path from 'path';

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
}

const BACKUP_DIR = '.mimo/backups';

export function createBackup(filePath: string, cwd: string = process.cwd()): BackupInfo {
  const resolved = path.resolve(filePath);
  const timestamp = Date.now();
  const backupPath = path.join(cwd, BACKUP_DIR, `${timestamp}-${path.basename(resolved)}`);

  const dir = path.dirname(backupPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(resolved, backupPath);

  return { originalPath: resolved, backupPath };
}

export function restoreFromBackup(backup: BackupInfo): void {
  fs.copyFileSync(backup.backupPath, backup.originalPath);
}

export function restoreAllBackups(backups: BackupInfo[]): void {
  for (const backup of backups) {
    restoreFromBackup(backup);
  }
}

export function cleanupBackups(cwd: string = process.cwd()): void {
  const dir = path.join(cwd, BACKUP_DIR);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
