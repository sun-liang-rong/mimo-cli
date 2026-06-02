import readline from 'readline';
import { ToolDefinition } from '../tools/registry';
/**
 * 权限门控 — 判断工具调用是否需要用户确认
 */
export declare function checkPermission(toolDef: ToolDefinition, args: Record<string, unknown>, rl: readline.Interface): Promise<boolean>;
//# sourceMappingURL=permissions.d.ts.map