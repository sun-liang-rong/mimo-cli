import fs from 'fs';
import path from 'path';
import { toolRegistry, ToolDefinition, ToolResult } from './registry';
import { checkPathSafety } from '../utils/safety';

export interface MultiEditArgs {
  edits: Array<{
    path: string;
    old_string: string;
    new_string: string;
  }>;
}

interface EditOperation {
  path: string;
  old_string: string;
  new_string: string;
  resolved: string;
  originalContent: string;
}

function handleMultiEdit(args: MultiEditArgs): ToolResult {
  const edits = args.edits;
  if (!edits || edits.length === 0) {
    return { success: false, output: '', error: 'No edits provided' };
  }

  const operations: EditOperation[] = [];

  // 1. Validate all edits
  for (const edit of edits) {
    const resolved = path.resolve(edit.path);
    const safetyError = checkPathSafety(resolved);
    if (safetyError) {
      return { success: false, output: '', error: `Safety check failed for ${edit.path}: ${safetyError}` };
    }

    if (!fs.existsSync(resolved)) {
      return { success: false, output: '', error: `File does not exist: ${resolved}` };
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    if (!content.includes(edit.old_string)) {
      return {
        success: false,
        output: '',
        error: `Could not find match in ${edit.path}: "${edit.old_string.slice(0, 50)}..."`,
      };
    }

    operations.push({
      path: edit.path,
      old_string: edit.old_string,
      new_string: edit.new_string,
      resolved,
      originalContent: content,
    });
  }

  // 2. Atomic execution
  const applied: EditOperation[] = [];
  try {
    for (const op of operations) {
      const newContent = op.originalContent.replace(op.old_string, op.new_string);
      fs.writeFileSync(op.resolved, newContent, 'utf-8');
      applied.push(op);
    }
  } catch (err: unknown) {
    // 3. Rollback on failure
    for (const op of applied) {
      fs.writeFileSync(op.resolved, op.originalContent, 'utf-8');
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, output: '', error: `Edit failed, rolled back: ${msg}` };
  }

  return {
    success: true,
    output: `Successfully edited ${operations.length} file(s)`,
  };
}

const multiEditDef: ToolDefinition = {
  name: 'multi_edit',
  description: 'Atomically edit multiple files. All edits either succeed or fail together.',
  permission: 'write',
  parameters: {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: 'List of edits to apply',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            old_string: { type: 'string', description: 'Text to replace' },
            new_string: { type: 'string', description: 'Replacement text' },
          },
          required: ['path', 'old_string', 'new_string'],
        },
      },
    },
    required: ['edits'],
  },
};

export function registerMultiEditTool(): void {
  toolRegistry.register(multiEditDef, (args: Record<string, unknown>) => {
    return handleMultiEdit(args as unknown as MultiEditArgs);
  });
}
