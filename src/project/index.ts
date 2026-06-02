import fs from 'fs';
import path from 'path';

export interface ProjectIndex {
  files: { source: string[]; config: string[]; test: string[]; docs: string[] };
  symbols: Array<{ name: string; type: 'function' | 'class' | 'interface' | 'variable'; file: string; line: number }>;
  meta: { language: string; framework?: string; packageManager: string };
}

// Simple recursive file scanner (NO external glob dependency)
function scanFiles(dir: string, results: string[] = [], depth: number = 0): string[] {
  if (depth > 3) return results; // Limit depth for speed
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanFiles(fullPath, results, depth + 1);
      } else {
        results.push(fullPath);
      }
    }
  } catch { /* ignore permission errors */ }
  return results;
}

export function buildProjectIndex(cwd: string = process.cwd()): ProjectIndex {
  const index: ProjectIndex = {
    files: { source: [], config: [], test: [], docs: [] },
    symbols: [],
    meta: { language: 'unknown', packageManager: 'npm' },
  };

  // Scan files (limit depth for speed)
  const allFiles = scanFiles(cwd).map(f => path.relative(cwd, f));

  for (const file of allFiles.slice(0, 200)) { // Limit to 200 files
    if (file.match(/\.(ts|tsx|js|jsx)$/)) index.files.source.push(file);
    else if (file.match(/\.(json|yaml|yml|toml)$/)) index.files.config.push(file);
    else if (file.match(/\.(test|spec)\./)) index.files.test.push(file);
    else if (file.match(/\.(md|rst)$/)) index.files.docs.push(file);
  }

  // Parse package.json
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      index.meta.language = index.files.source.some(f => f.endsWith('.ts')) ? 'typescript' : 'javascript';
      if (pkg.dependencies?.react) index.meta.framework = 'react';
      else if (pkg.dependencies?.vue) index.meta.framework = 'vue';
      else if (pkg.dependencies?.express) index.meta.framework = 'express';
      index.meta.packageManager = fs.existsSync(path.join(cwd, 'pnpm-lock.yaml')) ? 'pnpm' :
        fs.existsSync(path.join(cwd, 'yarn.lock')) ? 'yarn' : 'npm';
    }
  } catch { /* ignore */ }

  // Quick regex symbol scan (first 50 source files only)
  for (const file of index.files.source.slice(0, 50)) {
    try {
      const content = fs.readFileSync(path.join(cwd, file), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) index.symbols.push({ name: funcMatch[1], type: 'function', file, line: i + 1 });
        const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
        if (classMatch) index.symbols.push({ name: classMatch[1], type: 'class', file, line: i + 1 });
        const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) index.symbols.push({ name: interfaceMatch[1], type: 'interface', file, line: i + 1 });
      }
    } catch { /* ignore */ }
  }

  return index;
}

export function saveIndex(index: ProjectIndex, cwd: string = process.cwd()): void {
  const cachePath = path.join(cwd, '.mimo', 'project-index.json');
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(index, null, 2), 'utf-8');
}

export function loadIndex(cwd: string = process.cwd()): ProjectIndex | null {
  const cachePath = path.join(cwd, '.mimo', 'project-index.json');
  if (!fs.existsSync(cachePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as ProjectIndex;
  } catch { return null; }
}
