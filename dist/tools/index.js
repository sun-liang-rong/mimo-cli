"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllTools = registerAllTools;
const file_1 = require("./file");
const exec_1 = require("./exec");
const search_1 = require("./search");
const git_1 = require("./git");
const view_1 = require("./view");
const edit_1 = require("./edit");
const multi_edit_1 = require("./multi-edit");
/** 注册所有工具到全局注册表 */
function registerAllTools() {
    (0, file_1.registerFileTools)();
    (0, exec_1.registerExecTools)();
    (0, search_1.registerSearchTools)();
    (0, git_1.registerGitTools)();
    (0, view_1.registerViewTool)();
    (0, edit_1.registerEditTool)();
    (0, multi_edit_1.registerMultiEditTool)();
}
//# sourceMappingURL=index.js.map