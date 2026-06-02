"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerMultiEditTool = registerMultiEditTool;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const registry_1 = require("./registry");
const safety_1 = require("../utils/safety");
function handleMultiEdit(args) {
    const edits = args.edits;
    if (!edits || edits.length === 0) {
        return { success: false, output: '', error: 'No edits provided' };
    }
    const operations = [];
    // 1. Validate all edits
    for (const edit of edits) {
        const resolved = path_1.default.resolve(edit.path);
        const safetyError = (0, safety_1.checkPathSafety)(resolved);
        if (safetyError) {
            return { success: false, output: '', error: `Safety check failed for ${edit.path}: ${safetyError}` };
        }
        if (!fs_1.default.existsSync(resolved)) {
            return { success: false, output: '', error: `File does not exist: ${resolved}` };
        }
        const content = fs_1.default.readFileSync(resolved, 'utf-8');
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
    const applied = [];
    try {
        for (const op of operations) {
            const newContent = op.originalContent.replace(op.old_string, op.new_string);
            fs_1.default.writeFileSync(op.resolved, newContent, 'utf-8');
            applied.push(op);
        }
    }
    catch (err) {
        // 3. Rollback on failure
        for (const op of applied) {
            fs_1.default.writeFileSync(op.resolved, op.originalContent, 'utf-8');
        }
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, output: '', error: `Edit failed, rolled back: ${msg}` };
    }
    return {
        success: true,
        output: `Successfully edited ${operations.length} file(s)`,
    };
}
const multiEditDef = {
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
function registerMultiEditTool() {
    registry_1.toolRegistry.register(multiEditDef, (args) => {
        return handleMultiEdit(args);
    });
}
//# sourceMappingURL=multi-edit.js.map