import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { SessionStore } from '../store.js'

describe('SessionStore', () => {
  let store: SessionStore
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `mimo-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(tmpDir, { recursive: true })
    store = new SessionStore({ sessionDir: tmpDir, maxSessions: 5 })
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('should create a new session', async () => {
    const session = await store.create('test-model')
    expect(session.id).toBeDefined()
    expect(session.model).toBe('test-model')
    expect(session.messages).toEqual([])
  })

  it('should save and load a session', async () => {
    const session = await store.create('test-model')
    session.messages = [{ role: 'user', content: 'hello' }]
    await store.save(session)
    const loaded = await store.load(session.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.messages).toHaveLength(1)
  })

  it('should return null for non-existent session', async () => {
    const loaded = await store.load('non-existent')
    expect(loaded).toBeNull()
  })

  it('should list sessions sorted by updatedAt', async () => {
    const s1 = await store.create('m1')
    await new Promise(r => setTimeout(r, 10))
    const s2 = await store.create('m2')
    const sessions = await store.list()
    expect(sessions.length).toBeGreaterThanOrEqual(2)
    expect(sessions[0].id).toBe(s2.id)
  })

  it('should get latest session', async () => {
    await store.create('m1')
    await new Promise(r => setTimeout(r, 10))
    const s2 = await store.create('m2')
    const latest = await store.getLatest()
    expect(latest).not.toBeNull()
    expect(latest!.id).toBe(s2.id)
  })

  it('should delete a session', async () => {
    const session = await store.create('test-model')
    const deleted = await store.delete(session.id)
    expect(deleted).toBe(true)
    const loaded = await store.load(session.id)
    expect(loaded).toBeNull()
  })

  it('should return false when deleting non-existent session', async () => {
    const deleted = await store.delete('non-existent')
    expect(deleted).toBe(false)
  })

  it('should clear all sessions', async () => {
    await store.create('m1')
    await store.create('m2')
    await store.clearAll()
    const sessions = await store.list()
    expect(sessions).toEqual([])
  })

  it('should prune old sessions beyond maxSessions', async () => {
    for (let i = 0; i < 8; i++) {
      await store.create(`m${i}`)
      await new Promise(r => setTimeout(r, 5))
    }
    const sessions = await store.list()
    expect(sessions.length).toBeLessThanOrEqual(5)
  })

  it('should update session updatedAt on save', async () => {
    const session = await store.create('test-model')
    const originalUpdated = session.updatedAt
    await new Promise(r => setTimeout(r, 50))
    await store.save(session)
    expect(session.updatedAt).not.toBe(originalUpdated)
  })

  it('should return empty list when no sessions exist', async () => {
    const sessions = await store.list()
    expect(sessions).toEqual([])
  })

  it('should return null for latest when no sessions', async () => {
    const latest = await store.getLatest()
    expect(latest).toBeNull()
  })

  it('should handle session with messages', async () => {
    const session = await store.create('test-model')
    session.messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'how are you?' },
    ]
    await store.save(session)
    const loaded = await store.load(session.id)
    expect(loaded!.messages).toHaveLength(3)
  })

  it('should preserve config', () => {
    const config = store.getConfig()
    expect(config.sessionDir).toBe(tmpDir)
    expect(config.maxSessions).toBe(5)
  })

  it('should handle concurrent creates', async () => {
    const promises = Array.from({ length: 5 }, (_, i) => store.create(`m${i}`))
    const sessions = await Promise.all(promises)
    const ids = new Set(sessions.map(s => s.id))
    expect(ids.size).toBe(5)
  })
})
