import { registerFileTools } from './file';
import { registerExecTools } from './exec';
import { registerSearchTools } from './search';
import { registerGitTools } from './git';
import { registerViewTool } from './view';
import { registerEditTool } from './edit';
import { registerMultiEditTool } from './multi-edit';

/** 注册所有工具到全局注册表 */
export function registerAllTools(): void {
  registerFileTools();
  registerExecTools();
  registerSearchTools();
  registerGitTools();
  registerViewTool();
  registerEditTool();
  registerMultiEditTool();
}
