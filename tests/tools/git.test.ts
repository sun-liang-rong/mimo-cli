import { gitStatusHandler, gitDiffHandler } from '../../src/tools/git';

describe('Git Tools', () => {
  it('should get git status', async () => {
    const result = await gitStatusHandler({ path: '.' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('分支');
  }, 10000);

  it('should get git diff', async () => {
    const result = await gitDiffHandler({ path: '.' });
    expect(result.success).toBe(true);
  }, 10000);
});
