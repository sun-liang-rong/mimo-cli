"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectIndex = buildProjectIndex;
exports.saveIndex = saveIndex;
exports.loadIndex = loadIndex;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Simple recursive file scanner (NO external glob dependency)
function scanFiles(dir, results = [], depth = 0) {
    if (depth > 3)
        return results; // Limit depth for speed
    try {
        const entries = fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
                continue;
            const fullPath = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                scanFiles(fullPath, results, depth + 1);
            }
            else {
                results.push(fullPath);
            }
        }
    }
    catch { /* ignore permission errors */ }
    return results;
}
function buildProjectIndex(cwd = process.cwd()) {
    const index = {
        files: { source: [], config: [], test: [], docs: [] },
        symbols: [],
        meta: { language: 'unknown', packageManager: 'npm' },
    };
    // Scan files (limit depth for speed)
    const allFiles = scanFiles(cwd).map(f => path_1.default.relative(cwd, f));
    for (const file of allFiles.slice(0, 200)) { // Limit to 200 files
        if (file.match(/\.(ts|tsx|js|jsx)$/))
            index.files.source.push(file);
        else if (file.match(/\.(json|yaml|yml|toml)$/))
            index.files.config.push(file);
        else if (file.match(/\.(test|spec)\./))
            index.files.test.push(file);
        else if (file.match(/\.(md|rst)$/))
            index.files.docs.push(file);
    }
    // Parse package.json
    try {
        const pkgPath = path_1.default.join(cwd, 'package.json');
        if (fs_1.default.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs_1.default.readFileSync(pkgPath, 'utf-8'));
            index.meta.language = index.files.source.some(f => f.endsWith('.ts')) ? 'typescript' : 'javascript';
            if (pkg.dependencies?.react)
                index.meta.framework = 'react';
            else if (pkg.dependencies?.vue)
                index.meta.framework = 'vue';
            else if (pkg.dependencies?.express)
                index.meta.framework = 'express';
            index.meta.packageManager = fs_1.default.existsSync(path_1.default.join(cwd, 'pnpm-lock.yaml')) ? 'pnpm' :
                fs_1.default.existsSync(path_1.default.join(cwd, 'yarn.lock')) ? 'yarn' : 'npm';
        }
    }
    catch { /* ignore */ }
    // Quick regex symbol scan (first 50 source files only)
    for (const file of index.files.source.slice(0, 50)) {
        try {
            const content = fs_1.default.readFileSync(path_1.default.join(cwd, file), 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
                if (funcMatch)
                    index.symbols.push({ name: funcMatch[1], type: 'function', file, line: i + 1 });
                const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
                if (classMatch)
                    index.symbols.push({ name: classMatch[1], type: 'class', file, line: i + 1 });
                const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
                if (interfaceMatch)
                    index.symbols.push({ name: interfaceMatch[1], type: 'interface', file, line: i + 1 });
            }
        }
        catch { /* ignore */ }
    }
    return index;
}
function saveIndex(index, cwd = process.cwd()) {
    const cachePath = path_1.default.join(cwd, '.mimo', 'project-index.json');
    const dir = path_1.default.dirname(cachePath);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(cachePath, JSON.stringify(index, null, 2), 'utf-8');
}
function loadIndex(cwd = process.cwd()) {
    const cachePath = path_1.default.join(cwd, '.mimo', 'project-index.json');
    if (!fs_1.default.existsSync(cachePath))
        return null;
    try {
        return JSON.parse(fs_1.default.readFileSync(cachePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=index.js.map