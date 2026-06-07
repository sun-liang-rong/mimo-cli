import { PermissionManager } from '../../src/security/permissions';

describe('PermissionManager', () => {
  let pm: PermissionManager;

  beforeEach(() => {
    pm = new PermissionManager();
  });

  it('should return safe for read_file', () => {
    expect(pm.getPermissionLevel('read_file', {})).toBe('safe');
  });

  it('should return confirm for write_file', () => {
    expect(pm.getPermissionLevel('write_file', {})).toBe('confirm');
  });

  it('should return dangerous for rm -rf in execute_command', () => {
    expect(pm.getPermissionLevel('execute_command', { command: 'rm -rf /tmp/test' })).toBe('dangerous');
  });

  it('should return confirm for normal execute_command', () => {
    expect(pm.getPermissionLevel('execute_command', { command: 'ls -la' })).toBe('confirm');
  });

  it('should auto-approve safe tools', async () => {
    const result = await pm.confirmExecution('read_file', { path: 'test.txt' });
    expect(result).toBe(true);
  });

  it('should auto-approve tools in autoApprove list', async () => {
    const pmWithAuto = new PermissionManager(['write_file']);
    const result = await pmWithAuto.confirmExecution('write_file', { path: 'test.txt', content: 'x' });
    expect(result).toBe(true);
  });

  it('should return safe for unknown tools when auto-approved', () => {
    const pmWithAuto = new PermissionManager(['custom_tool']);
    expect(pmWithAuto.getPermissionLevel('custom_tool', {})).toBe('safe');
  });
});
