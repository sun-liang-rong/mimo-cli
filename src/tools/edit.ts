import fs from 'fs';
import path from 'path';
import { checkPathSafety } from '../utils/safety';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';

// ── Types ──

export interface EditArgs {
  path: string;
  old_string: string;
  new_string: string;
}

// ── Tool Definition ──

const editDef: ToolDefinition = {
  name: 'edit',
  description: 'Edit a file by replacing old_string with new_string. old_string must match exactly; include context for uniqueness.',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path' },
      old_string: { type: 'string', description: 'Text to replace (must match exactly, include context for uniqueness)' },
      new_string: { type: 'string', description: 'Replacement text' },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

// ── Levenshtein Distance ──

/**
 * Calculate the Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows instead of full matrix to reduce memory usage
  let prev: number[] = new Array(n + 1);
  let curr: number[] = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,        // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

// ── Fuzzy Find ──

/**
 * Calculate similarity between two strings using Levenshtein distance.
 * Returns a value between 0 and 1, where 1 means identical.
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

/**
 * Find the best fuzzy match for `target` within `content`.
 * Returns the start index of the match, or -1 if no suitable match is found.
 */
export function fuzzyFind(content: string, target: string): number {
  // Try exact match first
  const exactIndex = content.indexOf(target);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  // Try trimmed match
  const trimmedTarget = target.trim();
  if (trimmedTarget !== target) {
    const trimmedIndex = content.indexOf(trimmedTarget);
    if (trimmedIndex !== -1) {
      return trimmedIndex;
    }
  }

  // Fuzzy matching with Levenshtein distance
  // Use a sliding window approach
  const targetLen = target.length;
  const contentLen = content.length;

  if (targetLen === 0 || contentLen === 0) return -1;

  // Limit search window to reasonable bounds
  const windowSize = Math.min(targetLen + 20, contentLen);
  const threshold = 0.8;

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i <= contentLen - windowSize; i++) {
    const window = content.slice(i, i + windowSize);
    const score = similarity(window, target);

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  // Also try with trimmed target for fuzzy match
  if (trimmedTarget !== target && trimmedTarget.length > 0) {
    const trimmedWindowSize = Math.min(trimmedTarget.length + 20, contentLen);
    for (let i = 0; i <= contentLen - trimmedWindowSize; i++) {
      const window = content.slice(i, i + trimmedWindowSize);
      const score = similarity(window, trimmedTarget);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  if (bestScore >= threshold) {
    return bestIndex;
  }

  return -1;
}

// ── Handler ──

export function handleEdit(args: Record<string, unknown>): ToolResult {
  const filePath = String(args.path);
  const oldString = String(args.old_string);
  const newString = String(args.new_string);
  const resolved = path.resolve(filePath);

  // Check path safety
  const safetyError = checkPathSafety(resolved);
  if (safetyError) {
    return { success: false, output: '', error: safetyError };
  }

  // Check file exists
  if (!fs.existsSync(resolved)) {
    return { success: false, output: '', error: `文件不存在: ${resolved}` };
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');

    // Try exact match first
    let matchIndex = content.indexOf(oldString);

    // Fall back to fuzzy match
    if (matchIndex === -1) {
      matchIndex = fuzzyFind(content, oldString);
    }

    if (matchIndex === -1) {
      return { success: false, output: '', error: `未找到要替换的文本，请确保 old_string 精确匹配文件内容` };
    }

    // Perform replacement
    const before = content.slice(0, matchIndex);
    const after = content.slice(matchIndex + oldString.length);
    const updated = before + newString + after;

    fs.writeFileSync(resolved, updated, 'utf-8');
    return { success: true, output: `文件已编辑: ${resolved}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `编辑失败: ${msg}` };
  }
}

// ── Registration ──

export function registerEditTool(): void {
  toolRegistry.register(editDef, handleEdit);
}
