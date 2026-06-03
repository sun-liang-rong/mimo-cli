import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { TimelineView, pickVisibleItems } from '../TimelineView.js'
import {
  createTimeline,
  addUserMessage,
  createAgentTask,
  addStep,
  completeTask,
} from '../timeline.js'

describe('TimelineView', () => {
  it('should render empty timeline', () => {
    const timeline = createTimeline()
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    expect(lastFrame()).toBeDefined()
  })

  it('should render user message', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Hello MiMo')
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    expect(lastFrame()).toContain('Hello MiMo')
  })

  it('should render user message and agent task', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Fix the bug')
    timeline = createAgentTask(timeline, 50)
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    const output = lastFrame()
    expect(output).toContain('Fix the bug')
    expect(output).toMatch(/thinking|Thinking/)
  })

  it('should render multiple items', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'First message')
    timeline = createAgentTask(timeline, 50)
    timeline = completeTask(timeline)
    timeline = addUserMessage(timeline, 'Second message')
    timeline = createAgentTask(timeline, 50)
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    const output = lastFrame()
    // The latest task and at least the immediate predecessor are guaranteed visible.
    expect(output).toContain('Second message')
  })

  it('should render `›` prefix for user messages', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Test')
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    expect(lastFrame()).toContain('›')
    expect(lastFrame()).toContain('Test')
  })
})

describe('pickVisibleItems (windowing regression)', () => {
  function makeLargeTask(id: string) {
    let t = createTimeline()
    t = createAgentTask(t, 50)
    // Add many steps so this task alone occupies many "lines"
    for (let i = 0; i < 20; i++) {
      t = addStep(t, {
        id: `${id}-s${i}`,
        type: 'tool-call',
        status: 'completed',
        label: `Step ${i}`,
        startedAt: i,
        completedAt: i + 1,
      })
    }
    return t.items[t.items.length - 1]!
  }

  it('returns empty array for empty input', () => {
    expect(pickVisibleItems([], 10)).toEqual([])
  })

  it('returns the latest item when it alone fills the viewport', () => {
    // Regression: previously this hid the latest item, leaving an empty screen
    // even though the status bar still reported activity.
    const large = makeLargeTask('latest')
    const visible = pickVisibleItems([large], 2)
    expect(visible).toHaveLength(1)
    expect(visible[0]).toBe(large)
  })

  it('walks backwards and includes older items while they fit', () => {
    const old = { id: 'a', type: 'user-message' as const, content: 'old', timestamp: 0 }
    const mid = { id: 'b', type: 'user-message' as const, content: 'mid', timestamp: 1 }
    const last = { id: 'c', type: 'user-message' as const, content: 'last', timestamp: 2 }
    const visible = pickVisibleItems([old, mid, last], 4)
    // With 4 lines and 1-line user messages, all 3 should fit.
    expect(visible.map(i => i.id)).toEqual(['a', 'b', 'c'])
  })

  it('drops the oldest item first when there is no room', () => {
    const a = { id: 'a', type: 'user-message' as const, content: 'a', timestamp: 0 }
    const b = { id: 'b', type: 'user-message' as const, content: 'b', timestamp: 1 }
    const c = { id: 'c', type: 'user-message' as const, content: 'c', timestamp: 2 }
    const visible = pickVisibleItems([a, b, c], 2)
    // 2 lines available → keep last 2
    expect(visible.map(i => i.id)).toEqual(['b', 'c'])
  })
})
