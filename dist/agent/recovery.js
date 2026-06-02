"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackup = createBackup;
exports.restoreFromBackup = restoreFromBackup;
exports.restoreAllBackups = restoreAllBackups;
exports.cleanupBackups = cleanupBackups;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const BACKUP_DIR = '.mimo/backups';
function createBackup(filePath, cwd = process.cwd()) {
    const resolved = path_1.default.resolve(filePath);
    const timestamp = Date.now();
    const backupPath = path_1.default.join(cwd, BACKUP_DIR, `${timestamp}-${path_1.default.basename(resolved)}`);
    const dir = path_1.default.dirname(backupPath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.copyFileSync(resolved, backupPath);
    return { originalPath: resolved, backupPath };
}
function restoreFromBackup(backup) {
    fs_1.default.copyFileSync(backup.backupPath, backup.originalPath);
}
function restoreAllBackups(backups) {
    for (const backup of backups) {
        restoreFromBackup(backup);
    }
}
function cleanupBackups(cwd = process.cwd()) {
    const dir = path_1.default.join(cwd, BACKUP_DIR);
    if (fs_1.default.existsSync(dir)) {
        fs_1.default.rmSync(dir, { recursive: true, force: true });
    }
}
//# sourceMappingURL=recovery.js.map