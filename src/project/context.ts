import { ProjectIndex } from './index';

export function buildProjectContext(index: ProjectIndex): string {
  const lines: string[] = [];
  lines.push(`Project: ${index.meta.language}${index.meta.framework ? ` (${index.meta.framework})` : ''}`);
  lines.push(`Files: ${index.files.source.length} source`);
  if (index.symbols.length > 0) lines.push(`Symbols: ${index.symbols.length}`);
  return lines.join('\n');
}

export function selectRelevantFiles(query: string, index: ProjectIndex): string[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return [];

  const matched = index.symbols
    .filter(s => keywords.some(k => s.name.toLowerCase().includes(k)))
    .map(s => s.file);

  const fileMatches = index.files.source.filter(f =>
    keywords.some(k => f.toLowerCase().includes(k))
  );

  return [...new Set([...matched, ...fileMatches])].slice(0, 5);
}
