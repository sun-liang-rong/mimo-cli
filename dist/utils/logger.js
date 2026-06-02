"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = void 0;
const chalk_1 = __importDefault(require("chalk"));
exports.log = {
    info: (msg) => console.log(chalk_1.default.cyan('[info]'), msg),
    success: (msg) => console.log(chalk_1.default.green('[ok]'), msg),
    warn: (msg) => console.log(chalk_1.default.yellow('[warn]'), msg),
    error: (msg) => console.log(chalk_1.default.red('[error]'), msg),
    debug: (msg) => console.log(chalk_1.default.gray('[debug]'), msg),
    dim: (msg) => console.log(chalk_1.default.dim(msg)),
    userInput: (msg) => console.log(chalk_1.default.green.bold('user'), msg),
    aiReply: (msg) => console.log(chalk_1.default.blue.bold('assistant'), msg),
    system: (msg) => console.log(chalk_1.default.gray('[system]'), msg),
    code: (code, lang) => {
        const header = lang ? chalk_1.default.gray(`-- ${lang} --`) : chalk_1.default.gray('-- code --');
        console.log(header);
        console.log(chalk_1.default.dim(code));
        console.log(chalk_1.default.gray('-'.repeat(40)));
    },
    plain: (msg) => console.log(msg),
    write: (text) => process.stdout.write(text),
    newline: () => console.log(),
};
//# sourceMappingURL=logger.js.map