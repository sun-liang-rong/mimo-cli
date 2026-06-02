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
