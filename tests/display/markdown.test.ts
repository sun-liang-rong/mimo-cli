import { renderMarkdown } from '../../src/display/markdown';

describe('renderMarkdown', () => {
  it('should render headers', () => {
    const result = renderMarkdown('# Title');
    expect(result).toContain('Title');
  });

  it('should render code blocks', () => {
    const input = '```typescript\nconst x = 1;\n```';
    const result = renderMarkdown(input);
    expect(result).toContain('const');
  });

  it('should render inline code', () => {
    const result = renderMarkdown('Use `npm install`');
    expect(result).toContain('npm install');
  });

  it('should render lists', () => {
    const result = renderMarkdown('- item 1\n- item 2');
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
  });

  it('should render bold text', () => {
    const result = renderMarkdown('**bold**');
    expect(result).toContain('bold');
  });

  it('should handle empty input', () => {
    const result = renderMarkdown('');
    expect(result).toBe('');
  });

  it('should render links', () => {
    const result = renderMarkdown('[Google](https://google.com)');
    expect(result).toContain('Google');
  });
});
