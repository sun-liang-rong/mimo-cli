"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserMessage = createUserMessage;
exports.createAiMessage = createAiMessage;
exports.createToolCallCard = createToolCallCard;
exports.createThinkingBlock = createThinkingBlock;
const chalk_1 = __importDefault(require("chalk"));
const codex_renderer_1 = require("./codex-renderer");
function createUserMessage(text) {
    return chalk_1.default.green.bold((0, codex_renderer_1.formatUserMessage)(text));
}
function createAiMessage(text) {
    return chalk_1.default.blue.bold((0, codex_renderer_1.formatAssistantMessage)(text));
}
function createToolCallCard(name, args) {
    return chalk_1.default.yellow((0, codex_renderer_1.formatToolCall)(name, args));
}
function createThinkingBlock(text) {
    return chalk_1.default.gray((0, codex_renderer_1.formatThinkingDone)(text));
}
//# sourceMappingURL=components.js.map