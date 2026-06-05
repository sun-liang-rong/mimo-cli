import * as fs from 'fs';
import * as path from 'path';
import { readFileHandler, writeFileHandler, listFilesHandler } from '../../src/tools/file';

describe('File Tools', () => {
  const testDir = path.join(__dirname, 'test-fixtures');
  const testFile = path.join(testDir, 'test.txt');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  it('should write file', async () => {
    const result = await writeFileHandler({ path: testFile, content: 'Hello World' });
    expect(result.success).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);
  });

  it('should read file', async () => {
    const result = await readFileHandler({ path: testFile });
    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello World');
  });

  it('should list files', async () => {
    const result = await listFilesHandler({ path: testDir });
    expect(result.success).toBe(true);
    expect(result.output).toContain('test.txt');
  });

  it('should handle non-existent file', async () => {
    const result = await readFileHandler({ path: '/non/existent/file.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
