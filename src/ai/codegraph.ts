import * as fs from 'fs';
import * as path from 'path';
import { ensureMimoDir } from '../utils/paths.js';

export interface GraphNode {
  filePath: string;
  imports: string[];
  exports: string[];
  dependents: string[];
  lastModified: number;
}

function getGraphPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(home, '.mimo', 'codegraph.json');
}

const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', 'target', '.mimo', '.jest-cache', '.cache', '.turbo', 'coverage', '.venv']);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php']);

export class CodeGraphBuilder {
  private graph: Map<string, GraphNode> = new Map();
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
    this.load();
  }

  /** Build or incrementally update the graph */
  build(): void {
    const files = this.walkFiles(this.rootDir);

    for (const filePath of files) {
      const stat = fs.statSync(filePath);
      const existing = this.graph.get(filePath);

      // Skip if file hasn't changed since last build
      if (existing && existing.lastModified >= stat.mtimeMs) continue;

      const node = this.parseFile(filePath);
      if (node) {
        this.graph.set(filePath, node);
      }
    }

    // Build reverse dependency map (dependents)
    this.buildDependents();
    this.save();
  }

  /** Incrementally update files that changed */
  updateFiles(filePaths: string[]): void {
    for (const fp of filePaths) {
      const absPath = path.resolve(this.rootDir, fp);
      if (!fs.existsSync(absPath)) {
        this.graph.delete(absPath);
        continue;
      }
      const node = this.parseFile(absPath);
      if (node) this.graph.set(absPath, node);
    }
    this.buildDependents();
    this.save();
  }

  /** Query: which files depend on the given file */
  getDependents(filePath: string): string[] {
    const absPath = path.resolve(this.rootDir, filePath);
    const node = this.graph.get(absPath);
    return node?.dependents || [];
  }

  /** Query: what does the given file import */
  getImports(filePath: string): string[] {
    const absPath = path.resolve(this.rootDir, filePath);
    const node = this.graph.get(absPath);
    return node?.imports || [];
  }

  /** Query: find all files that export the given symbol */
  findExport(symbol: string): string[] {
    const results: string[] = [];
    for (const [fp, node] of this.graph) {
      if (node.exports.includes(symbol)) {
        results.push(fp);
      }
    }
    return results;
  }

  /** Get a compact context string for AI injection (max ~1000 tokens) */
  getContextString(maxTokens = 1000): string {
    if (this.graph.size === 0) return '';
    let ctx = '## 代码依赖图谱\n';
    let estimate = 0;

    // Summarize: show key files and their dependency count
    const summaries: string[] = [];
    for (const [fp, node] of this.graph) {
      const rel = path.relative(this.rootDir, fp);
      if (node.imports.length > 0 || node.dependents.length > 0) {
        const line = `- ${rel}: imports ${node.imports.length}, used by ${node.dependents.length}`;
        const tokens = Math.ceil(line.length * 0.3);
        if (estimate + tokens > maxTokens) break;
        estimate += tokens;
        summaries.push(line);
      }
    }

    ctx += summaries.join('\n') + `\n(共 ${this.graph.size} 个文件)`;
    return ctx;
  }

  private parseFile(filePath: string): GraphNode | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath);

      const imports: string[] = [];
      const exports: string[] = [];

      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        // Parse JS/TS imports
        const importRegex = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          const importPath = match[1] || match[2];
          if (importPath && !importPath.startsWith('.') === false || importPath.startsWith('.')) {
            const resolved = this.resolveImport(filePath, importPath);
            if (resolved) imports.push(resolved);
          }
        }

        // Parse JS/TS exports
        const exportRegex = /(?:export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)|export\s+\{([^}]+)\})/g;
        while ((match = exportRegex.exec(content)) !== null) {
          if (match[1]) exports.push(match[1]);
          if (match[2]) {
            match[2].split(',').forEach(e => {
              const name = e.trim().split(/\s+as\s+/)[0].trim();
              if (name) exports.push(name);
            });
          }
        }
      } else if (ext === '.py') {
        const pyImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
        let match;
        while ((match = pyImportRegex.exec(content)) !== null) {
          const importPath = match[1] || match[2];
          if (importPath && importPath.startsWith('.')) {
            const resolved = this.resolvePyImport(filePath, importPath);
            if (resolved) imports.push(resolved);
          }
        }

        const pyDefRegex = /(?:def\s+(\w+)|class\s+(\w+))/g;
        while ((match = pyDefRegex.exec(content)) !== null) {
          if (match[1] && !match[1].startsWith('_')) exports.push(match[1]);
          if (match[2]) exports.push(match[2]);
        }
      }

      return {
        filePath,
        imports,
        exports,
        dependents: [],
        lastModified: stat.mtimeMs,
      };
    } catch {
      return null;
    }
  }

  private resolveImport(fromFile: string, importPath: string): string | null {
    if (!importPath.startsWith('.')) return null;
    const dir = path.dirname(fromFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
    for (const ext of extensions) {
      const candidate = path.resolve(dir, importPath + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private resolvePyImport(fromFile: string, importPath: string): string | null {
    const dir = path.dirname(fromFile);
    const parts = importPath.replace(/^\./, '').split('.');
    const candidate = path.resolve(dir, ...parts.map(p => p || path.basename(dir))) + '.py';
    if (fs.existsSync(candidate)) return candidate;
    const initCandidate = path.resolve(dir, ...parts, '__init__.py');
    if (fs.existsSync(initCandidate)) return initCandidate;
    return null;
  }

  private buildDependents(): void {
    // Clear existing dependents
    for (const node of this.graph.values()) {
      node.dependents = [];
    }

    // Build reverse map
    for (const [fp, node] of this.graph) {
      for (const imp of node.imports) {
        const dep = this.graph.get(imp);
        if (dep && !dep.dependents.includes(fp)) {
          dep.dependents.push(fp);
        }
      }
    }
  }

  private walkFiles(dir: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= 1000) break;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
            results.push(...this.walkFiles(fullPath));
          }
        } else if (entry.isFile() && CODE_EXTENSIONS.has(path.extname(entry.name))) {
          results.push(fullPath);
        }
      }
    } catch { /* skip */ }
    return results;
  }

  private save(): void {
    ensureMimoDir();
    const data = Array.from(this.graph.entries());
    fs.writeFileSync(getGraphPath(), JSON.stringify(data, null, 2));
  }

  private load(): void {
    const graphPath = getGraphPath();
    if (fs.existsSync(graphPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
        if (Array.isArray(data)) {
          for (const [key, value] of data) {
            this.graph.set(key, value);
          }
        }
      } catch { /* ignore */ }
    }
  }

  clear(): void {
    this.graph.clear();
    this.save();
  }
}
