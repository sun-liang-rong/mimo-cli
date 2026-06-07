import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Override HOME before importing the module
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mimo-hist-test-'));
const origHome = process.env.HOME;
process.env.HOME = tmpDir;

import { saveSession, loadSession, listSessions } from '../../src/storage/history';
import { Message } from '../../src/ai/client';

describe('Session History', () => {
  afterAll(() => {
    if (origHome !== undefined) process.env.HOME = origHome;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }
  });

  const messages: Message[] = [
    { role: 'user', content: 'test message' },
    { role: 'assistant', content: 'test reply' },
  ];

  it('should save and load session', () => {
    const id = saveSession(messages);
    expect(id).toBeDefined();
    const session = loadSession(id);
    expect(session).not.toBeNull();
    expect(session!.messages).toHaveLength(2);
    expect(session!.metadata.turns).toBe(1);
    expect(session!.metadata.summary).toBe('test message');
  });

  it('should list sessions', () => {
    const sessions = listSessions();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
  });

  it('should return null for non-existent session', () => {
    const session = loadSession('nonexistent-id-999999');
    expect(session).toBeNull();
  });
});
