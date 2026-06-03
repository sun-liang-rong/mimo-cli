import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusBar } from '../StatusBar.js'

describe('StatusBar', () => {
  it('should render model name', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo-7B-RL"
        phase="thinking"
        iteration={1}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={0}
        workingDir="/home/user/project"
      />
    )
    expect(lastFrame()).toContain('MiMo-7B-RL')
  })

  it('should render thinking phase', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="thinking"
        iteration={1}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={3000}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('Thinking')
  })

  it('should render executing-tools phase with tool count', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="executing-tools"
        iteration={3}
        maxIterations={50}
        toolCallsTotal={5}
        toolCallsActive={2}
        tokenCount={1234}
        duration={60000}
        workingDir="/project"
      />
    )
    const output = lastFrame()
    expect(output).toContain('5 tools')
    expect(output).toContain('Iter 3')
    expect(output).toContain('(2 active)')
  })

  it('should render duration in mm:ss format', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="streaming-text"
        iteration={1}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={500}
        duration={125000}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('2:05')
  })

  it('should render Ready for completed phase', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="completed"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={3}
        toolCallsActive={0}
        tokenCount={1000}
        duration={0}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('Ready')
  })

  it('should render Ready for idle phase', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="idle"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={0}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('Ready')
  })

  it('should render token count when > 0', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="completed"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={45678}
        duration={0}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('45,678 tok')
  })

  it('should render error phase', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="error"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={0}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('Error')
  })

  it('should render awaiting-approval phase', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="awaiting-approval"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={0}
        workingDir="/project"
      />
    )
    expect(lastFrame()).toContain('Awaiting')
  })

  it('should render working directory', () => {
    const { lastFrame } = render(
      <StatusBar
        model="MiMo"
        phase="idle"
        iteration={0}
        maxIterations={50}
        toolCallsTotal={0}
        toolCallsActive={0}
        tokenCount={0}
        duration={0}
        workingDir="/home/user/my-project"
      />
    )
    expect(lastFrame()).toContain('my-project')
  })
})
