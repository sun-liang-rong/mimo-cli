import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../ai/client.js';
import { ensureDir } from '../utils/paths.js';

export interface SessionMetadata {
  id: string;
  timestamp: number;
  date: string;
  turns: number;
  summary: string;
}

export interface SessionData {
  metadata: SessionMetadata;
  messages: Message[];
}

function getHistoryDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
  return path.join(homeDir, '.mimo', 'history');
}

function ensureHistoryDir(): void {
  ensureDir(getHistoryDir());
}

export function saveSession(messages: Message[]): string {
  ensureHistoryDir();
  const id = Date.now().toString();
  const userMessages = messages.filter(m => m.role === 'user');
  const summary = userMessages.length > 0 ? (userMessages[0].content || '').slice(0, 100) : '空对话';
  const data: SessionData = {
    metadata: { id, timestamp: Date.now(), date: new Date().toISOString(), turns: userMessages.length, summary },
    messages,
  };
  fs.writeFileSync(path.join(getHistoryDir(), `${id}.json`), JSON.stringify(data, null, 2));
  return id;
}

export function loadSession(id: string): SessionData | null {
  const filePath = path.join(getHistoryDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function listSessions(): SessionMetadata[] {
  ensureHistoryDir();
  const dir = getHistoryDir();
  try {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse();
    return files.slice(0, 50).map(f => {
      try {
        const data: SessionData = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        return data.metadata;
      } catch {
        return null;
      }
    }).filter(Boolean) as SessionMetadata[];
  } catch {
    return [];
  }
}

export function deleteSession(id: string): boolean {
  const filePath = path.join(getHistoryDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
