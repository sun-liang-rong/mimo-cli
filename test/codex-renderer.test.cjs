const test = require('node:test');
const assert = require('node:assert/strict');

// 测试 theme 常量
const theme = require('../dist/ui/theme.js');

test('theme exports expected constants', () => {
  assert.ok(theme.Colors);
  assert.ok(theme.Icons);
  assert.equal(typeof theme.Colors.user, 'string');
  assert.equal(typeof theme.Icons.assistant, 'string');
});

test('theme icons are correct values', () => {
  const { Icons } = theme;
  assert.equal(Icons.user, 'user');
  assert.equal(Icons.assistant, '●');
  assert.equal(Icons.thinking, ':');
  assert.equal(Icons.toolCall, '▸');
  assert.equal(Icons.prompt, '> ');
});

// 测试 markdown 渲染
const markdown = require('../dist/ui/markdown.js');

test('markdown renderMarkdown returns string', () => {
  const result = markdown.renderMarkdown('hello **world**');
  assert.equal(typeof result, 'string');
  assert.ok(result.length > 0);
});

test('markdown hasMarkdown detects markdown features', () => {
  assert.equal(markdown.hasMarkdown('```js\ncode\n```'), true);
  assert.equal(markdown.hasMarkdown('**bold**'), true);
  assert.equal(markdown.hasMarkdown('plain text'), false);
});
