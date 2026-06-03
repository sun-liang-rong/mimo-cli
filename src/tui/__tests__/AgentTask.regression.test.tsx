import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AgentTaskView } from '../AgentTask.js'
import type { AgentTaskItem } from '../types.js'

function makeTask(overrides: Partial<AgentTaskItem> = {}): AgentTaskItem {
  return {
    type: 'agent-task',
    id: 'task-1',
    status: 'completed',
    phase: 'completed',
    steps: [],
    streamingText: '',
    startedAt: Date.now() - 46000,
    iterationCount: 0,
    maxIterations: 50,
    finalText: '',
    ...overrides,
  }
}

describe('AgentTaskView with long paths (regression for garbled output)', () => {
  it('renders a Write tool call with long file path without mangling', () => {
    const longPath = '/Users/sunliangrong/Desktop/mimo-cli/src/bubble-sort.ts'
    const task = makeTask({
      steps: [
        {
          id: 's1',
          type: 'tool-call',
          status: 'completed',
          label: 'Write file',
          startedAt: 0,
          completedAt: 100,
          duration: 100,
          toolCall: {
            id: 'tc1',
            name: 'Write',
            args: { file_path: longPath },
            summary: longPath,
            result: `File written successfully: ${longPath}`,
            success: true,
            duration: 100,
          },
        },
      ],
    })

    const { lastFrame } = render(
      <AgentTaskView
        task={task}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )

    const out = lastFrame() ?? ''
    // Print raw output for visual inspection
    console.log('===RENDERED-START===\n' + out + '\n===RENDERED-END===')
    expect(out).toMatch(/●/)
    expect(out).toMatch(/⎿/)
    expect(out).toContain('Write')
    expect(out).toContain('bubble-sort.ts')
    expect(out).toContain('File written successfully')
  })

  it('renders a Bash tool call with CJK result without mangling', () => {
    const task = makeTask({
      steps: [
        {
          id: 's1',
          type: 'tool-call',
          status: 'completed',
          label: 'Bash command',
          startedAt: 0,
          completedAt: 100,
          duration: 100,
          toolCall: {
            id: 'tc1',
            name: 'Bash',
            args: { command: 'echo "测试冒泡排序算法"' },
            summary: 'echo "测试冒泡排序算法"',
            result: '测试冒泡排序算法',
            success: true,
            duration: 100,
          },
        },
      ],
    })

    const { lastFrame } = render(
      <AgentTaskView
        task={task}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )

    const out = lastFrame() ?? ''
    expect(out).toMatch(/●/)
    expect(out).toMatch(/⎿/)
    expect(out).toContain('Bash')
    expect(out).toContain('测试冒泡排序算法')
  })

  it('renders many tool calls with folding summary', () => {
    const steps = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      type: 'tool-call' as const,
      status: 'completed' as const,
      label: `Step ${i}`,
      startedAt: i,
      completedAt: i + 1,
      duration: 1,
      toolCall: {
        id: `tc${i}`,
        name: 'Read',
        args: {},
        summary: `file${i}.ts`,
        result: `content ${i}`,
        success: true,
        duration: 1,
      },
    }))

    const task = makeTask({ steps })
    const { lastFrame } = render(
      <AgentTaskView
        task={task}
        expandedSteps={new Set()}
        onToggleStep={() => {}}
      />
    )

    const out = lastFrame() ?? ''
    // The "earlier tool calls" summary line must be present when folded.
    expect(out).toMatch(/earlier tool calls?/)
    // The visible 8 steps must include the LAST 8, not the first 8.
    expect(out).toContain('file19.ts')
    // Earlier steps must be hidden in collapsed view.
    expect(out).not.toContain('file5.ts')
  })
})
