import * as fs from 'fs';
import * as path from 'path';
import { readFileHandler, writeFileHandler, listFilesHandler, editFileHandler, searchFilesHandler } from '../../src/tools/file';

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
    const result = await writeFileHandler({ path: testFile, content: 'Hello World\nLine 2\nLine 3' });
    expect(result.success).toBe(true);
    expect(fs.existsSync(testFile)).toBe(true);
  });

  it('should read file', async () => {
    const result = await readFileHandler({ path: testFile });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello World');
    // Now output includes line numbers
    expect(result.output).toContain('│ Hello World');
  });

  it('should read file with offset and limit', async () => {
    const result = await readFileHandler({ path: testFile, offset: 1, limit: 1 });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 2');
    expect(result.output).not.toContain('Hello World');
  });

  it('should edit file', async () => {
    const result = await editFileHandler({ path: testFile, old_string: 'Hello World', new_string: 'Hi World' });
    expect(result.success).toBe(true);
    const content = fs.readFileSync(testFile, 'utf-8');
    expect(content).toContain('Hi World');
    expect(content).not.toContain('Hello World');
    // Restore
    fs.writeFileSync(testFile, 'Hello World\nLine 2\nLine 3', 'utf-8');
  });

  it('should fail edit when old_string not found', async () => {
    const result = await editFileHandler({ path: testFile, old_string: 'NONEXISTENT', new_string: 'X' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('未找到');
  });

  it('should search files', async () => {
    const result = await searchFilesHandler({ pattern: 'Line', path: testDir });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 2');
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
