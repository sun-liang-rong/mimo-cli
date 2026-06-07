import { detectProject, getProjectSummary } from '../../src/context/project';

describe('Project Context', () => {
  it('should detect this project as node', () => {
    const info = detectProject('.');
    expect(info.type).toBe('node');
    expect(info.language).toContain('TypeScript');
    expect(info.name).toBe('mimo-cli');
  });

  it('should return project summary', () => {
    const summary = getProjectSummary('.');
    expect(summary).toContain('mimo-cli');
    expect(summary).toContain('项目信息');
  });

  it('should detect unknown for empty dir', () => {
    const info = detectProject('/tmp');
    expect(info.type).toBe('unknown');
  });
});
