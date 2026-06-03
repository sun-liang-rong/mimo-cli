import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { MemoryStore } from '../store.js'

describe('MemoryStore', () => {
  let store: MemoryStore
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `mimo-memory-test-${Date.now()}`)
    await fs.mkdir(tmpDir, { recursive: true })
    store = new MemoryStore(tmpDir)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  })

  it('should save a memory entry', async () => {
    const entry = await store.save({
      name: 'test-memory',
      type: 'project',
      description: 'Test memory',
      content: 'This is test content',
      tags: ['test'],
    })
    expect(entry.name).toBe('test-memory')
    expect(entry.type).toBe('project')
    expect(entry.createdAt).toBeDefined()
    expect(entry.updatedAt).toBeDefined()
  })

  it('should load a saved memory', async () => {
    await store.save({
      name: 'load-test',
      type: 'user',
      description: 'Load test',
      content: 'Content to load',
      tags: [],
    })
    const loaded = await store.get('load-test')
    expect(loaded).not.toBeNull()
    expect(loaded!.content).toBe('Content to load')
  })

  it('should return null for non-existent memory', async () => {
    const result = await store.get('non-existent')
    expect(result).toBeNull()
  })

  it('should list all memories', async () => {
    await store.save({ name: 'm1', type: 'project', description: 'd1', content: 'c1', tags: [] })
    await store.save({ name: 'm2', type: 'user', description: 'd2', content: 'c2', tags: [] })
    const list = await store.list()
    expect(list.length).toBe(2)
  })

  it('should filter by type', async () => {
    await store.save({ name: 'proj', type: 'project', description: 'p', content: 'c', tags: [] })
    await store.save({ name: 'user', type: 'user', description: 'u', content: 'c', tags: [] })
    const projects = await store.getByType('project')
    expect(projects.length).toBe(1)
    expect(projects[0].name).toBe('proj')
  })

  it('should search memories', async () => {
    await store.save({ name: 'search-test', type: 'project', description: 'TypeScript rules', content: 'Always use strict mode', tags: ['ts'] })
    const results = await store.search('TypeScript')
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('search-test')
  })

  it('should search by tags', async () => {
    await store.save({ name: 'tagged', type: 'project', description: 'd', content: 'c', tags: ['important'] })
    const results = await store.search('important')
    expect(results.length).toBe(1)
  })

  it('should delete a memory', async () => {
    await store.save({ name: 'to-delete', type: 'project', description: 'd', content: 'c', tags: [] })
    const deleted = await store.delete('to-delete')
    expect(deleted).toBe(true)
    const result = await store.get('to-delete')
    expect(result).toBeNull()
  })

  it('should return false when deleting non-existent', async () => {
    const deleted = await store.delete('non-existent')
    expect(deleted).toBe(false)
  })

  it('should update existing memory', async () => {
    await store.save({ name: 'update-test', type: 'project', description: 'old', content: 'old content', tags: [] })
    await store.save({ name: 'update-test', type: 'project', description: 'new', content: 'new content', tags: ['updated'] })
    const loaded = await store.get('update-test')
    expect(loaded!.content).toBe('new content')
    expect(loaded!.description).toBe('new')
  })

  it('should export as prompt context', async () => {
    await store.save({ name: 'user-pref', type: 'user', description: 'Preferred style', content: 'Concise answers', tags: [] })
    await store.save({ name: 'proj-rule', type: 'project', description: 'Code style', content: 'Use TypeScript', tags: [] })
    const context = store.toPromptContext()
    expect(context).toContain('[Memory Context]')
    expect(context).toContain('Concise answers')
    expect(context).toContain('Use TypeScript')
  })

  it('should return empty prompt context when no memories', () => {
    const context = store.toPromptContext()
    expect(context).toBe('')
  })

  it('should create index file', async () => {
    await store.save({ name: 'index-test', type: 'project', description: 'Index test', content: 'content', tags: [] })
    const indexContent = await fs.readFile(path.join(tmpDir, 'MEMORY.md'), 'utf-8')
    expect(indexContent).toContain('index-test')
  })

  it('should handle reference type', async () => {
    await store.save({ name: 'ref-test', type: 'reference', description: 'API docs', content: 'https://api.example.com', tags: ['api'] })
    const loaded = await store.get('ref-test')
    expect(loaded!.type).toBe('reference')
  })

  it('should handle feedback type', async () => {
    await store.save({ name: 'feedback-test', type: 'feedback', description: 'User correction', content: 'Do not use var', tags: [] })
    const loaded = await store.get('feedback-test')
    expect(loaded!.type).toBe('feedback')
  })

  it('should handle empty search results', async () => {
    const results = await store.search('nonexistent')
    expect(results).toEqual([])
  })

  it('should preserve tags', async () => {
    await store.save({ name: 'tagged', type: 'project', description: 'd', content: 'c', tags: ['a', 'b', 'c'] })
    const loaded = await store.get('tagged')
    expect(loaded!.tags).toEqual(['a', 'b', 'c'])
  })

  it('should handle multiple memories of same type', async () => {
    await store.save({ name: 'p1', type: 'project', description: 'd1', content: 'c1', tags: [] })
    await store.save({ name: 'p2', type: 'project', description: 'd2', content: 'c2', tags: [] })
    await store.save({ name: 'p3', type: 'project', description: 'd3', content: 'c3', tags: [] })
    const projects = await store.getByType('project')
    expect(projects.length).toBe(3)
  })

  it('should generate unique file names per type', async () => {
    await store.save({ name: 'same-name', type: 'project', description: 'd', content: 'c', tags: [] })
    await store.save({ name: 'same-name', type: 'user', description: 'd', content: 'c', tags: [] })
    const list = await store.list()
    expect(list.length).toBe(2)
  })
})
