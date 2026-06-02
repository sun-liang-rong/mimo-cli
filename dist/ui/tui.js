"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTui = initTui;
exports.getTui = getTui;
const blessed_1 = __importDefault(require("blessed"));
let tui = null;
function initTui() {
    const screen = blessed_1.default.screen({
        smartCSR: true,
        title: 'MiMo CLI',
    });
    const topBar = blessed_1.default.box({
        top: 0, left: 0, width: '100%', height: 1,
        content: ' mimo · v1.0.0',
        style: { fg: 'black', bg: 'cyan' },
        tags: true,
    });
    const taskPanel = blessed_1.default.box({
        top: 1, right: 0, width: 30, height: '100%-3',
        border: { type: 'line' },
        label: ' Tasks ',
        style: { fg: 'white', bg: '#1a1a2e', border: { fg: 'cyan' } },
        tags: true, scrollable: true, alwaysScroll: true,
    });
    const chatBox = blessed_1.default.log({
        top: 1, left: 0, width: '100%-30', height: '100%-3',
        border: { type: 'line' },
        label: ' Chat ',
        style: { fg: 'white', bg: '#0f0f23', border: { fg: 'blue' } },
        tags: true, scrollable: true, alwaysScroll: true,
    });
    const inputBox = blessed_1.default.textbox({
        bottom: 1, left: 0, width: '100%', height: 1,
        content: 'You ▸ ',
        style: { fg: 'white', bg: '#333' },
        inputOnFocus: true,
    });
    const footerBar = blessed_1.default.box({
        bottom: 0, left: 0, width: '100%', height: 1,
        content: ' default · model · Activity: idle ',
        style: { fg: 'white', bg: '#333' },
        tags: true,
    });
    screen.append(topBar);
    screen.append(chatBox);
    screen.append(taskPanel);
    screen.append(inputBox);
    screen.append(footerBar);
    screen.key(['C-c'], () => process.exit(0));
    tui = { screen, topBar, chatBox, taskPanel, inputBox, footerBar };
    return tui;
}
function getTui() { return tui; }
//# sourceMappingURL=tui.js.map