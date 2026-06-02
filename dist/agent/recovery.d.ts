export interface BackupInfo {
    originalPath: string;
    backupPath: string;
}
export declare function createBackup(filePath: string, cwd?: string): BackupInfo;
export declare function restoreFromBackup(backup: BackupInfo): void;
export declare function restoreAllBackups(backups: BackupInfo[]): void;
export declare function cleanupBackups(cwd?: string): void;
//# sourceMappingURL=recovery.d.ts.map