"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProjectContext = buildProjectContext;
exports.selectRelevantFiles = selectRelevantFiles;
function buildProjectContext(index) {
    const lines = [];
    lines.push(`Project: ${index.meta.language}${index.meta.framework ? ` (${index.meta.framework})` : ''}`);
    lines.push(`Files: ${index.files.source.length} source`);
    if (index.symbols.length > 0)
        lines.push(`Symbols: ${index.symbols.length}`);
    return lines.join('\n');
}
function selectRelevantFiles(query, index) {
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (keywords.length === 0)
        return [];
    const matched = index.symbols
        .filter(s => keywords.some(k => s.name.toLowerCase().includes(k)))
        .map(s => s.file);
    const fileMatches = index.files.source.filter(f => keywords.some(k => f.toLowerCase().includes(k)));
    return [...new Set([...matched, ...fileMatches])].slice(0, 5);
}
//# sourceMappingURL=context.js.map