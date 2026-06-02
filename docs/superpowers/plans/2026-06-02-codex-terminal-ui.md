# Codex Terminal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default full-screen blessed UI with a simple Codex-style scrolling terminal interface that avoids mojibake-prone symbols.

**Architecture:** Add a pure renderer for stable prompt/message strings, then make `layout.ts` use Node readline instead of blessed. Keep the public layout API used by `chat.ts` so the chat command needs minimal behavioral changes.

**Tech Stack:** TypeScript, Node readline, chalk, node:test.

---

### Task 1: Renderer Contract

**Files:**
- Create: `src/ui/codex-renderer.ts`
- Test: `test/codex-renderer.test.cjs`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const renderer = require('../dist/ui/codex-renderer.js');

test('formats chat roles without box drawing or emoji symbols', () => {
  assert.equal(renderer.formatUserMessage('hello'), '\nuser\nhello');
  assert.equal(renderer.formatAssistantMessage('hi'), '\nassistant\nhi');
  assert.equal(renderer.formatToolCall('read_file', 'src/index.ts'), '  tool read_file src/index.ts');
  assert.equal(renderer.formatToolResult('read_file', true), '  ok read_file');
});

test('status and prompt strings are ascii safe', () => {
  const output = [
    renderer.formatHeader({ model: 'mimo-v2.5-pro', permissionMode: 'default' }),
    renderer.formatPrompt(),
    renderer.formatThinking(),
    renderer.formatToolResult('run_command', false),
  ].join('\n');
  assert.equal(/[^\x00-\x7F]/.test(output), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build` then `node --test test/codex-renderer.test.cjs`
Expected: FAIL because `dist/ui/codex-renderer.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/codex-renderer.ts` with exported formatting functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build` then `node --test test/codex-renderer.test.cjs`
Expected: PASS.

### Task 2: Readline Layout

**Files:**
- Modify: `src/ui/layout.ts`
- Modify: `src/ui/components.ts`
- Modify: `package.json`

- [ ] **Step 1: Replace blessed layout API internals**

Keep `initLayout`, `appendChat`, `clearChat`, `refreshTaskPanel`, `startInputLoop`, `continueInputLoop`, `stopInputLoop`, `refreshAll`, `renderTopBar`, and `renderFooterBar`, but implement them using stdout/readline.

- [ ] **Step 2: Simplify message component formatting**

Make components call the Codex renderer and avoid Unicode symbols.

- [ ] **Step 3: Add test script**

Add `"test": "npm run build && node --test test/*.test.cjs"` to `package.json`.

- [ ] **Step 4: Verify**

Run: `npm test` and `npm run build`
Expected: both pass with exit code 0.
