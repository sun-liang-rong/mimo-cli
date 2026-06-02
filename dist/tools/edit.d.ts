import { ToolResult } from './registry';
export interface EditArgs {
    path: string;
    old_string: string;
    new_string: string;
}
/**
 * Calculate the Levenshtein distance between two strings.
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other.
 */
export declare function levenshteinDistance(a: string, b: string): number;
/**
 * Find the best fuzzy match for `target` within `content`.
 * Returns the start index of the match, or -1 if no suitable match is found.
 */
export declare function fuzzyFind(content: string, target: string): number;
export declare function handleEdit(args: Record<string, unknown>): ToolResult;
export declare function registerEditTool(): void;
//# sourceMappingURL=edit.d.ts.map