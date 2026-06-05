import { executeCommandHandler } from '../../src/tools/command';

describe('Command Tools', () => {
  it('should execute simple command', async () => {
    const result = await executeCommandHandler({ command: 'echo hello' });
    expect(result.success).toBe(true);
    expect(result.output.trim()).toBe('hello');
  });

  it('should handle command failure', async () => {
    const result = await executeCommandHandler({ command: 'exit 1' });
    expect(result.success).toBe(false);
  });
});
