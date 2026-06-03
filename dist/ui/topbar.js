"use strict";
// src/ui/topbar.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopBar = void 0;
const blessed_1 = __importDefault(require("blessed"));
const theme_1 = require("./theme");
class TopBar {
    box;
    constructor(screen) {
        this.box = blessed_1.default.box({
            parent: screen,
            top: 0,
            left: 0,
            width: '100%',
            height: 1,
            content: '',
            style: {
                fg: theme_1.Colors.topBarFg,
                bg: theme_1.Colors.topBarBg,
            },
            tags: true,
        });
    }
    update(state) {
        const parts = [
            ' mimo',
            ` · ${state.model}`,
            ` · ${state.permissionMode}`,
            ` · v${state.version}`,
        ];
        this.box.setContent(parts.join(''));
        this.box.screen.render();
    }
}
exports.TopBar = TopBar;
//# sourceMappingURL=topbar.js.map