"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCommandSafety = checkCommandSafety;
exports.checkPathSafety = checkPathSafety;
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
/** 高危命令黑名单（正则） */
const DANGEROUS_COMMANDS = [
    /\brm\s+(-[rfR]+\s+)*\//i, // rm -rf /
    /\brm\s+(-[rfR]+\s+)*~\//i, // rm -rf ~
    /\bformat\b/i, // format
    /\bmkfs\b/i, // mkfs
    /\bdd\b.*of=\/dev/i, // dd of=/dev/...
    /\b:(){ :\|:& };:/, // fork bomb
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\bhalt\b/i,
    /\binit\s+0\b/i,
    /\bchmod\s+(-R\s+)?777\s+\//i, // chmod 777 /
    />\s*\/dev\/sd[a-z]/i, // write to disk device
    /\biptables\s+-F/i, // flush firewall
    /\brm\s+.*--no-preserve-root/i,
];
/** 敏感目录前缀（禁止文件操作） */
const SENSITIVE_PATHS = [
    '/etc',
    '/boot',
    '/dev',
    '/proc',
    '/sys',
    '/usr/bin',
    '/usr/sbin',
    '/sbin',
    '/bin',
    'C:\\Windows',
    'C:\\Program Files',
    'C:\\Program Files (x86)',
];
/**
 * 检查命令是否为高危命令
 * @returns 如果安全返回 null，否则返回拦截原因
 */
function checkCommandSafety(cmd) {
    for (const pattern of DANGEROUS_COMMANDS) {
        if (pattern.test(cmd)) {
            return `检测到高危命令，已被安全策略拦截: ${cmd}`;
        }
    }
    return null;
}
/**
 * 检查文件路径是否在安全范围内
 * @returns 如果安全返回 null，否则返回拦截原因
 */
function checkPathSafety(filePath) {
    const resolved = path_1.default.resolve(filePath);
    const homeDir = os_1.default.homedir();
    // 必须在用户主目录或当前工作目录下
    const cwd = process.cwd();
    if (!resolved.startsWith(cwd) && !resolved.startsWith(homeDir)) {
        return `路径超出安全范围，仅允许操作当前项目目录和用户主目录下的文件: ${resolved}`;
    }
    // 检查敏感目录
    for (const sensitive of SENSITIVE_PATHS) {
        if (resolved.toLowerCase().startsWith(sensitive.toLowerCase())) {
            return `禁止访问系统敏感目录: ${sensitive}`;
        }
    }
    return null;
}
//# sourceMappingURL=safety.js.map