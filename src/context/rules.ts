import * as fs from 'fs';
import * as path from 'path';

const RULES_FILES = ['MIMO.md', 'CLAUDE.md', 'AGENTS.md', '.mimo-rules.md'];

/**
 * Load project rules from MIMO.md / CLAUDE.md / AGENTS.md files.
 * Scans from project root and all subdirectories up to depth 3.
 * More deeply nested files take precedence in case of conflicts.
 */
export function loadProjectRules(projectRoot?: string, maxDepth = 3): { content: string; files: string[] } {
  const root = projectRoot || process.cwd();
  const foundFiles: string[] = [];
  let content = '';

  // Scan root and subdirectories
  const files = scanForRules(root, maxDepth);

  for (const filePath of files) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      if (fileContent.trim()) {
        const relPath = path.relative(root, filePath);
        foundFiles.push(relPath);
        content += `\n### 规则: ${relPath}\n${fileContent.trim()}\n`;
      }
    } catch { /* skip */ }
  }

  return { content, files: foundFiles };
}

/**
 * Get a compressed rules context for AI injection.
 */
export function getRulesContext(projectRoot?: string, maxTokens = 1500): string {
  const { content, files } = loadProjectRules(projectRoot);
  if (!content) return '';

  let result = '## 项目规则\n';
  result += `(来自 ${files.join(', ')})\n\n`;

  // Compress if too long
  if (result.length + content.length > maxTokens * 4) {
    result += content.slice(0, maxTokens * 4 - result.length);
    result += '\n... (规则过长，已截断)';
  } else {
    result += content;
  }

  return result;
}

function scanForRules(dir: string, maxDepth: number, currentDepth = 0): string[] {
  const results: string[] = [];

  // Check current directory
  for (const name of RULES_FILES) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) {
      results.push(filePath);
    }
  }

  // Recurse into subdirectories
  if (currentDepth < maxDepth) {
    const ignore = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', 'target', '.mimo', '.cache']);
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !ignore.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...scanForRules(path.join(dir, entry.name), maxDepth, currentDepth + 1));
        }
      }
    } catch { /* skip */ }
  }

  return results;
}

/**
 * Load and parse dependency info from package.json and package-lock.json
 */
export function getDependencyInfo(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  let info = '';

  try {
    const pkgPath = path.join(root, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.entries(pkg.dependencies || {});
      const devDeps = Object.entries(pkg.devDependencies || {});

      if (deps.length > 0) {
        info += '### 生产依赖\n';
        for (const [name, version] of deps.slice(0, 20)) {
          info += `- ${name}: ${version}\n`;
        }
        if (deps.length > 20) info += `... (共 ${deps.length} 个)\n`;
      }

      if (devDeps.length > 0) {
        info += '### 开发依赖\n';
        for (const [name, version] of devDeps.slice(0, 10)) {
          info += `- ${name}: ${version}\n`;
        }
        if (devDeps.length > 10) info += `... (共 ${devDeps.length} 个)\n`;
      }
    }
  } catch { /* skip */ }

  return info;
}
