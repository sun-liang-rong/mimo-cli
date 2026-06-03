import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { TimelineView } from '../TimelineView.js'
import { createTimeline, addUserMessage, createAgentTask, completeTask } from '../timeline.js'

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
    expect(output).toContain('Thinking')
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
    expect(output).toContain('First message')
    expect(output).toContain('Second message')
  })

  it('should render You label for user messages', () => {
    let timeline = createTimeline()
    timeline = addUserMessage(timeline, 'Test')
    const { lastFrame } = render(
      <TimelineView timeline={timeline} expandedSteps={new Set()} onToggleStep={() => {}} />
    )
    expect(lastFrame()).toContain('You')
  })
})
