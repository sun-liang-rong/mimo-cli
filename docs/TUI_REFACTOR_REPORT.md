# TUI Refactoring - Implementation Report

**Date**: 2026-06-03
**Status**: COMPLETE
**Test Results**: 341/341 PASS (0 failures)

---

## Summary

Successfully refactored MiMo CLI from a "Chat Interface" to an "Agent Workbench" by replacing the flat `ChatEntry[]` message list with a structured `Timeline` / `AgentTaskItem` / `TaskStep` architecture.

## Architecture Changes

### Before
```
App.tsx
  ├─ entries: ChatEntry[]          (flat, ephemeral)
  ├─ messages: Message[]           (API history, desynced)
  ├─ streamingText: string         (cleared each turn)
  ├─ liveTools: LiveToolCall[]     (cleared each turn)
  └─ status: AgentStatus           (single enum)

MessageList.tsx                    (renders flat list, tools disappear)
ToolCallBlock.tsx                  (one-line summary only)
StatusBar.tsx                      (4 fields)
```

### After
```
App.tsx
  ├─ timeline: Timeline            (single source of truth)
  ├─ expandedSteps: Set<string>    (collapsible detail)
  ├─ tokenCount: number            (accumulated)
  └─ taskStartTime: number         (live duration)

TimelineView.tsx                   (renders Timeline items)
  ├─ AgentTask.tsx                 (task block with header + steps)
  │   └─ TaskStep.tsx              (individual step)
  │       └─ ToolDetail.tsx        (collapsed/expanded tool view)
  └─ UserMessage.tsx               (inline)
StatusBar.tsx                      (7 fields: model, phase, iteration, tools, tokens, duration, dir)
```

## Files Created (8)

| File | Purpose | Lines |
|------|---------|-------|
| `src/tui/timeline.ts` | Pure state management functions | 148 |
| `src/tui/events.ts` | Typed event emitter | 42 |
| `src/tui/TimelineView.tsx` | Main timeline container | 48 |
| `src/tui/AgentTask.tsx` | Task block with steps | 105 |
| `src/tui/TaskStep.tsx` | Individual step rendering | 52 |
| `src/tui/ToolDetail.tsx` | Expanded/collapsed tool view | 108 |
| `src/tui/__tests__/timeline.test.ts` | Timeline function tests | 175 |
| `src/tui/__tests__/events.test.ts` | Event emitter tests | 72 |
| `src/tui/__tests__/ToolDetail.test.tsx` | ToolDetail component tests | 115 |
| `src/tui/__tests__/TaskStep.test.tsx` | TaskStep component tests | 80 |
| `src/tui/__tests__/AgentTask.test.tsx` | AgentTask component tests | 108 |
| `src/tui/__tests__/TimelineView.test.tsx` | TimelineView component tests | 60 |
| `src/tui/__tests__/StatusBar.test.tsx` | StatusBar component tests | 120 |
| `src/tui/__tests__/types.test.ts` | Type validation tests | 27 |

## Files Modified (3)

| File | Changes |
|------|---------|
| `src/tui/types.ts` | Added 15 new types (AgentPhase, TaskStatus, Timeline, etc.) + AgentEvent union |
| `src/tui/StatusBar.tsx` | Rewritten: 7-field rich status bar with phase/iteration/tokens/duration |
| `src/tui/App.tsx` | Complete rewrite: Timeline architecture, event-driven updates |
| `src/agent/loop.ts` | Added AgentEventEmitter integration, emits 10 event types |
| `vitest.config.ts` | Added `.tsx` to test file patterns |

## Test Results

```
Test Files  21 passed (21)
Tests       341 passed (341)
Duration    10.47s
```

### New Tests Added: 119

| Test File | Tests | Status |
|-----------|-------|--------|
| `timeline.test.ts` | 22 | PASS |
| `events.test.ts` | 7 | PASS |
| `types.test.ts` | 4 | PASS |
| `ToolDetail.test.tsx` | 17 | PASS |
| `TaskStep.test.tsx` | 7 | PASS |
| `AgentTask.test.tsx` | 9 | PASS |
| `TimelineView.test.tsx` | 5 | PASS |
| `StatusBar.test.tsx` | 10 | PASS |

### Pre-existing Tests: 222 (all still passing)

| Test File | Tests | Status |
|-----------|-------|--------|
| `retry.test.ts` | 23 | PASS |
| `manager.test.ts` (context) | 39 | PASS |
| `MessageHistory.test.ts` | 20 | PASS |
| `planner.test.ts` | 19 | PASS |
| `orchestrator.test.ts` | 17 | PASS |
| `models.test.ts` | 19 | PASS |
| `loader.test.ts` | 19 | PASS |
| `store.test.ts` (memory) | 19 | PASS |
| `store.test.ts` (session) | 15 | PASS |
| `plugin.test.ts` | 15 | PASS |
| `diff.test.ts` | 17 | PASS |
| `git.test.ts` | 18 | PASS |
| `manager.test.ts` (permissions) | 20 | PASS |

## Key Improvements

### 1. Tool History Persistence
- **Before**: Tools flashed and disappeared after each turn
- **After**: Every tool call is a persistent `TaskStep` in the timeline

### 2. Execution Visibility
- **Before**: Single `AgentStatus` enum, no iteration awareness
- **After**: `AgentPhase` with 7 states, iteration counter, step-by-step progress

### 3. Data Integrity
- **Before**: Dual `entries`/`messages` state that desynchronized
- **After**: Single `Timeline` as source of truth

### 4. Status Bar
- **Before**: Model, status, message count, directory (4 fields)
- **After**: Model, phase, iteration, tool count, tokens, duration, directory (7 fields)

### 5. Tool Detail
- **Before**: One-line summary with emoji
- **After**: Collapsible detail with input args, output preview, duration

### 6. Phase Tracking
- **Before**: `idle | thinking | streaming | running-tool | awaiting-approval`
- **After**: `thinking | streaming-text | executing-tools | awaiting-approval | planning | completed | error`

## TypeScript Compilation

```
npx tsc --noEmit
(clean, no errors)
```

## Dependencies Added

| Package | Purpose |
|---------|---------|
| `ink-testing-library` (dev) | Component testing for Ink components |

## Breaking Changes

- `StatusBar` props changed from `{ model, status, workingDir, messageCount }` to `{ model, phase, iteration, maxIterations, toolCallsTotal, toolCallsActive, tokenCount, duration, workingDir }`
- `MessageList` component removed (replaced by `TimelineView`)
- `entries.ts` module removed (replaced by `timeline.ts`)
- `ChatEntry` type still exists for backward compat but is no longer used in the main flow

## What's Next (Phase 6 polish, not yet implemented)

- Scroll support for long timelines
- Tool timeline compact view
- Phase progress bar visualization
- Expand/collapse all steps shortcut
- Task metrics summary panel
