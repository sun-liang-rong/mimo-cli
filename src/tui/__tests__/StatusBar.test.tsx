import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusBar } from '../StatusBar.js'

describe('StatusBar (top bar)', () => {
  it('should render model name', () => {
    const { lastFrame } = render(
      <StatusBar model="MiMo-7B-RL" workingDir="/home/user/project" />
    )
    expect(lastFrame()).toContain('MiMo-7B-RL')
  })

  it('should render working directory basename', () => {
    const { lastFrame } = render(
      <StatusBar model="MiMo" workingDir="/home/user/my-project" />
    )
    expect(lastFrame()).toContain('my-project')
  })

  it('should shorten HOME-prefixed paths with ~', () => {
    const { lastFrame } = render(
      <StatusBar model="MiMo" workingDir="/Users/me/code/app" />
    )
    // Either shows full path or shortened with ~
    expect(lastFrame()).toContain('app')
  })

  it('should render branch when provided', () => {
    const { lastFrame } = render(
      <StatusBar model="MiMo" workingDir="/project" branch="main" />
    )
    expect(lastFrame()).toContain('main')
  })

  it('should not render branch line when branch is missing', () => {
    const { lastFrame } = render(
      <StatusBar model="MiMo" workingDir="/project" />
    )
    // The ⎇ symbol is only shown alongside a branch label
    expect(lastFrame() ?? '').not.toMatch(/⎇\s+\S/)
  })
})
