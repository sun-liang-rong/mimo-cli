"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULTS = void 0;
exports.getConfig = getConfig;
exports.get = get;
exports.set = set;
exports.resetConfig = resetConfig;
exports.showConfig = showConfig;
exports.isConfigured = isConfigured;
const conf_1 = __importDefault(require("conf"));
const DEFAULTS = {
    apiKey: '',
    baseUrl: 'https://api.mimo.xiaomi.com/v1',
    model: 'mimo-v2.5-pro',
    temperature: 0.7,
    maxTokens: 4096,
    maxContextTokens: 32000,
    thinkingMode: 'think',
    permissionMode: 'default',
};
exports.DEFAULTS = DEFAULTS;
const config = new conf_1.default({
    projectName: 'mimo-cli',
    defaults: DEFAULTS,
});
function getConfig() {
    return config.store;
}
function get(key) {
    return config.get(key);
}
function set(key, value) {
    config.set(key, value);
}
function resetConfig() {
    config.clear();
}
function showConfig() {
    const cfg = config.store;
    const masked = { ...cfg };
    if (masked.apiKey && masked.apiKey.length > 8) {
        masked.apiKey = masked.apiKey.slice(0, 4) + '****' + masked.apiKey.slice(-4);
    }
    return masked;
}
function isConfigured() {
    return !!config.get('apiKey');
}
//# sourceMappingURL=config.js.map