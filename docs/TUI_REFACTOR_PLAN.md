# MiMo CLI TUI Refactoring Plan

> From "Chat Interface" to "Agent Workbench"

**Author**: Principal Engineer, Claude Code Product Experience Design
**Date**: 2026-06-03
**Status**: Design Proposal

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [Core Defects Summary](#2-core-defects-summary)
3. [New Interaction Architecture](#3-new-interaction-architecture)
4. [New Data Flow Design](#4-new-data-flow-design)
5. [New Event Flow Design](#5-new-event-flow-design)
6. [New Task View Design](#6-new-task-view-design)
7. [Tool Chain Visualization](#7-tool-chain-visualization)
8. [New Status Bar Design](#8-new-status-bar-design)
9. [Long Task Experience Design](#9-long-task-experience-design)
10. [Claude Code Gap Analysis](#10-claude-code-gap-analysis)
11. [Implementation Roadmap](#11-implementation-roadmap)

---

## 1. Current Architecture Analysis

### 1.1 The Flat Message Model Problem

The current architecture uses a **flat `ChatEntry[]` array** as the single source of display truth:

```
App.tsx state:
  entries: ChatEntry[]        -- flat list of all display items
  messages: Message[]         -- API message history (separate truth)
  streamingText: string       -- current streaming chunk (ephemeral)
  liveTools: LiveToolCall[]   -- currently executing tools (ephemeral)
  status: AgentStatus         -- single enum for entire app state
```

**Why this causes every problem you listed:**

#### Problem 1: Message Overlap & Scroll Misalignment

`MessageList.tsx` renders three independent layers stacked vertically:

```
Layer 1: entries.map(entry => <ChatEntryView />)     -- static history
Layer 2: liveTools.map(tool => <ToolCallBlock />)     -- live tools
Layer 3: <Text>{streamingText}</Text>                 -- streaming text
Layer 4: <Spinner />                                  -- loading indicator
```

These layers are **not coordinated**. When `onToolCall` fires:
1. `streamingText` is cleared (line 188-189 of App.tsx)
2. `liveTools` gets a new entry
3. But `entries` still contains the old assistant text from the previous turn

The result: content from different moments in time coexists in the render tree without any causal link. Ink's flex layout tries to fit everything into `stdout.rows`, causing overflow and visual overlap.

#### Problem 2: Tool Information Loss

This is the most critical architectural flaw. Look at the lifecycle:

```
Turn starts:
  liveTools = [{id, name, args, status:'running'}]   -- SHOWN

Tool completes:
  onToolResult updates liveTools status to 'success'  -- SHOWN momentarily

Turn ends (line 264-275):
  setLiveTools([])          -- ALL TOOL HISTORY WIPED
  appendEntry(assistantEntry(finalStreamText))  -- only text saved
```

**Tool calls are ephemeral.** They exist only in `liveTools` during execution, then vanish. The `entries` array only stores the final assistant text response. The user sees tools flash by during execution, then they're gone forever.

The `toolEntryFromMessage` function in `entries.ts` exists but is **never called** from the main flow. It's dead code.

#### Problem 3: Dual State Desynchronization

`entries` (display) and `messages` (API) are maintained separately:

```
messages: updated via syncMessages()     -- for API context
entries:  updated via appendEntry()       -- for display
```

They drift apart because:
- `messages` includes tool_call and tool role messages
- `entries` only includes user/assistant/system/error
- There's no reconciliation between them

When a session is restored (line 74-78), `messages` is loaded from disk but `entries` is rebuilt from scratch via `messagesToEntries()` -- which skips user messages and tool calls with empty args.

#### Problem 4: Single Status Enum

```typescript
type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'awaiting-approval' | 'running-tool'
```

This is a **global** status for the entire application. When the agent makes 5 parallel tool calls, the status is just `'running-tool'`. There's no way to know:
- Which tool is running
- How many tools have completed
- What phase of execution we're in
- Whether we're in iteration 1 or iteration 15 of the agent loop

#### Problem 5: No Execution Timeline

The `AgentLoop` runs a `while(true)` loop (line 97 of loop.ts) that can iterate up to 50 times. Each iteration may involve:
- Thinking
- Streaming text
- Multiple tool calls (serial + parallel)
- Tool results
- Next iteration

But the UI has **no concept of iterations**. It just sees a continuous stream of callbacks. The user cannot distinguish "the AI is thinking about what to do next" from "the AI is waiting for tool results" from "the AI is about to give a final answer."

### 1.2 Component Architecture Problems

```
Current render tree:
  <Box height={stdout.rows}>
    <Box flexGrow=1 overflow="hidden">       -- scroll container (broken)
      <MessageList                             -- flat list renderer
        entries={entries}                      -- static history
        streamingText={streamingText}          -- ephemeral
        liveTools={liveTools}                  -- ephemeral
        status={status}                        -- single enum
      />
    </Box>
    <Box flexShrink=0>
      <ToolApproval />                         -- modal overlay
      <UserInput />
    </Box>
    <Box flexShrink=0>
      <StatusBar />
    </Box>
  </Box>
```

Issues:
- `overflow="hidden"` on the scroll container means content is clipped, not scrolled
- There's no scrollback mechanism -- once content leaves the viewport, it's gone
- `MessageList` receives all four data sources but has no way to compose them coherently
- `ToolApproval` appears between input and messages, breaking visual flow
- `StreamingMetrics` component exists but is **never used** in `App.tsx`

---

## 2. Core Defects Summary

| # | Defect | Root Cause | Impact |
|---|--------|------------|--------|
| 1 | Content overlap during streaming | Flat render with no layout coordination | Unreadable output |
| 2 | Tool history lost after turn | `liveTools` cleared on turn end, never persisted to entries | Cannot audit what happened |
| 3 | No execution timeline | AgentLoop iterations not surfaced to UI | User can't follow agent reasoning |
| 4 | Single global status | One `AgentStatus` enum for everything | No granularity |
| 5 | Dual state desync | `entries` and `messages` maintained separately | Data integrity issues |
| 6 | No scroll support | `overflow="hidden"` with no scroll state | Lost context |
| 7 | No task progress tracking | No concept of tasks, steps, or phases | Long tasks feel stuck |
| 8 | Chat-centric, not task-centric | Everything is a `ChatEntry` | Wrong abstraction |
| 9 | Tool results disconnected from answers | Tools ephemeral, answers permanent | No auditability |
| 10 | Minimal status bar | 4 fields, no metrics | No situational awareness |

---

## 3. New Interaction Architecture

### 3.1 Paradigm Shift: From Chat to Agent Timeline

**Current model**: ChatGPT-style message list
```
[User]  message
[Bot]   response
[User]  message
[Bot]   response
```

**New model**: Claude Code-style agent timeline
```
[User]   task description
[Agent]  thinking...
  [Step 1] Read src/index.ts
    > Read Tool: src/index.ts (45 lines, 1.2s)
  [Step 2] Analyzing imports...
  [Step 3] Edit src/index.ts
    > Edit Tool: src/index.ts (3 changes, 0.8s)
  [Step 4] Run tests
    > Bash: npm test (passed, 12.3s)
[Agent]  Here's what I did: ...
```

### 3.2 New Component Architecture

```
<App>
  <TaskContainer>                          -- replaces MessageList
    <TaskTimeline>                         -- scrollable execution timeline
      <UserMessage />                      -- user's request
      <AgentTask>                          -- one per agent turn
        <TaskHeader />                     -- "Agent is working on..."
        <StepList>
          <Step>                           -- one per logical action
            <StepHeader />                 -- step name + status
            <ToolCallDetail />             -- expanded tool view
            <ToolResultPreview />          -- truncated result
          </Step>
          <Step>...</Step>
        </StepList>
        <AgentThinking />                  -- streaming text
        <TaskSummary />                    -- final result
      </AgentTask>
    </TaskTimeline>
  </TaskContainer>

  <ToolApprovalModal />                    -- centered modal, not inline

  <InputArea>
    <UserInput />
  </InputArea>

  <StatusBar />                            -- rich status with metrics
</App>
```

### 3.3 Key Architectural Decisions

**Decision 1: Single Source of Truth**

Replace dual `entries`/`messages` with a unified `Timeline` model:

```typescript
interface Timeline {
  items: TimelineItem[]
}

type TimelineItem =
  | UserMessageItem
  | AgentTaskItem

interface AgentTaskItem {
  id: string
  status: 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
  startedAt: number
  completedAt?: number
  steps: TaskStep[]
  streamingText: string          // current streaming content
  finalText?: string             // completed response
  iterationCount: number         // which agent loop iteration
}

interface TaskStep {
  id: string
  type: 'thinking' | 'tool-call' | 'text' | 'error' | 'retry'
  status: 'pending' | 'running' | 'completed' | 'error'
  label: string                  // human-readable step description
  toolCall?: ToolCallDetail
  startedAt: number
  completedAt?: number
  duration?: number              // ms
}

interface ToolCallDetail {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  success?: boolean
  duration?: number
  // For display
  summary: string                // one-line summary
  preview?: string               // truncated result preview
}
```

**Decision 2: Immutable History + Mutable Active State**

```
Timeline:
  [completed items...]           -- immutable, scrollable
  [active AgentTask]             -- mutable, pinned to bottom
```

Completed items never re-render. Only the active task updates. This eliminates the overlap/scroll problems.

**Decision 3: Phase-Aware Rendering**

The `AgentLoop` exposes its current phase:

```typescript
type AgentPhase =
  | 'thinking'          // waiting for API response
  | 'streaming-text'    // receiving text chunks
  | 'executing-tools'   // running tool calls
  | 'awaiting-approval' // waiting for user permission
  | 'planning'          // analyzing results, deciding next step
  | 'completed'         // done
```

Each phase renders differently in the timeline.

---

## 4. New Data Flow Design

### 4.1 Event-Driven Architecture

Replace the callback-based system with an event emitter pattern:

```
AgentLoop
  │
  ├── emits: agent:start          → creates AgentTaskItem
  ├── emits: agent:thinking       → updates phase
  ├── emits: agent:text-chunk     → appends to streamingText
  ├── emits: agent:tool-call      → creates TaskStep
  ├── emits: agent:tool-result    → updates TaskStep
  ├── emits: agent:iteration      → increments iteration count
  ├── emits: agent:error          → marks step/task as error
  ├── emits: agent:retry          → creates retry step
  ├── emits: agent:complete       → finalizes AgentTaskItem
  └── emits: agent:cancel         → marks as cancelled
```

### 4.2 Store Architecture

```typescript
// Single store replacing all scattered state
interface AppState {
  timeline: Timeline
  activeTask: AgentTaskItem | null
  scrollOffset: number
  viewportHeight: number

  // Derived from activeTask
  status: AgentStatus
  phase: AgentPhase

  // Metrics (updated by events)
  metrics: {
    totalToolCalls: number
    totalDuration: number
    tokenUsage: { prompt: number; completion: number }
    contextUsage: { used: number; max: number }
    iterationCount: number
  }

  // UI state
  approval: ApprovalRequest | null
  expandedSteps: Set<string>     // which steps show full detail
}
```

### 4.3 Data Flow Diagram

```
User Input
    │
    ▼
App.handleUserMessage()
    │
    ├── Creates UserMessageItem → timeline.items.push()
    ├── Creates AgentTaskItem → activeTask = new task
    │
    ▼
AgentLoop.sendMessage()
    │
    ├── onThinking  → activeTask.phase = 'thinking'
    ├── onText      → activeTask.streamingText += chunk
    ├── onToolCall  → activeTask.steps.push(new Step)
    │                 step.status = 'running'
    ├── onToolResult→ step.status = 'completed'
    │                 step.toolCall.result = result
    ├── onIteration → activeTask.iterationCount++
    ├── onDone      → activeTask.status = 'completed'
    │                 activeTask.finalText = streamingText
    │                 timeline.items.push(activeTask)
    │                 activeTask = null
    └── onError     → activeTask.status = 'error'
                      step.status = 'error'
```

### 4.4 Session Persistence

The new `Timeline` model maps cleanly to session storage:

```typescript
interface SessionData {
  id: string
  model: string
  timeline: SerializedTimeline    // includes all tasks, steps, tool calls
  createdAt: string
  updatedAt: string
  metrics: SessionMetrics
}
```

This replaces the current broken dual-persistence of `messages` and `entries`.

---

## 5. New Event Flow Design

### 5.1 Agent Timeline Visualization

```
┌─────────────────────────────────────────────────────┐
│ You                                                 │
│ Refactor the authentication module to use JWT        │
│                                                      │
│ ┌─ Agent Task ─────────────────────────────────────┐ │
│ │ ● Running · Iteration 3/50 · 45s elapsed         │ │
│ │                                                   │ │
│ │ ✓ Step 1: Read current auth module                │ │
│ │   📖 Read src/auth/index.ts                       │ │
│ │     142 lines · 0.3s                              │ │
│ │                                                   │ │
│ │ ✓ Step 2: Search for auth patterns                │ │
│ │   🔍 Grep "authenticate" in src/                  │ │
│ │     12 matches in 5 files · 0.8s                  │ │
│ │                                                   │ │
│ │ ✓ Step 3: Analyze dependencies                    │ │
│ │   📖 Read src/auth/strategy.ts                    │ │
│ │     89 lines · 0.2s                               │ │
│ │                                                   │ │
│ │ ● Step 4: Implementing JWT strategy               │ │
│ │   ✏️ Write src/auth/jwt.ts                        │ │
│ │     Writing... (23 lines so far)                  │ │
│ │                                                   │ │
│ │   I'm creating a new JWT strategy class that      │ │
│ │   replaces the session-based approach. The key    │ │
│ │   changes are...▌                                 │ │
│ └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.2 Phase Transitions

```
thinking ──→ streaming-text ──→ executing-tools ──→ planning ──→ thinking
    │              │                    │               │
    │              │                    │               └─→ completed
    │              │                    └─→ awaiting-approval
    │              └─→ (text + tools mixed, show both)
    └─→ error
```

Each phase has a distinct visual treatment:

| Phase | Visual | Color |
|-------|--------|-------|
| thinking | Spinner + "Analyzing..." | yellow |
| streaming-text | Text with cursor | green |
| executing-tools | Tool steps with status | cyan |
| awaiting-approval | Yellow border, Y/N prompt | yellow |
| planning | Spinner + "Planning next step..." | blue |
| completed | Checkmark + summary | green |
| error | X mark + error details | red |

### 5.3 Multi-Tool Execution Visualization

When the agent calls multiple tools in parallel:

```
● Executing 3 tools in parallel...
  📖 Read src/a.ts ........... ✓ 0.3s
  🔍 Grep "pattern" ......... ✓ 0.8s
  📖 Read src/b.ts ........... ● running
```

When tools are serial (approval required):

```
● Executing tools sequentially...
  ✓ 📖 Read src/a.ts (0.3s)
  ✓ ✏️ Write src/a.ts (0.5s) -- requires approval
  ● 🔧 Edit src/b.ts -- running
```

---

## 6. New Task View Design

### 6.1 Task View Layout

```
┌─────────────────────────────────────────────────────────┐
│ Task: Refactor authentication module                     │
│ Status: Running · Phase: Executing Tools                 │
│ Progress: [████████░░░░░░░░░░░░] 4/10 steps             │
│ Duration: 2m 34s · Iteration: 3/50                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Completed Steps:                                         │
│   ✓ 1. Read src/auth/index.ts (142 lines, 0.3s)         │
│   ✓ 2. Grep "authenticate" (12 matches, 0.8s)           │
│   ✓ 3. Read src/auth/strategy.ts (89 lines, 0.2s)       │
│                                                          │
│ Current Step:                                            │
│   ● 4. Write src/auth/jwt.ts                             │
│     Writing JWT strategy implementation...               │
│     [23 lines written, in progress]                      │
│                                                          │
│ Pending Steps:                                           │
│   ○ 5. Write src/auth/middleware.ts                      │
│   ○ 6. Update src/routes/auth.ts                        │
│   ○ 7. Run tests                                        │
│   ○ 8. Fix test failures                                │
│   ○ 9. Update documentation                             │
│   ○ 10. Final review                                    │
│                                                          │
├─────────────────────────────────────────────────────────┤
│ Streaming Response:                                      │
│ I'm creating a new JWT strategy class that will         │
│ replace the session-based approach...▌                   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Task State Machine

```
                    ┌──────────┐
                    │  pending  │
                    └────┬─────┘
                         │ user sends message
                         ▼
                    ┌──────────┐
              ┌────►│  running  │◄────┐
              │     └────┬─────┘     │
              │          │           │ next iteration
              │     ┌────┴─────┐     │
              │     │ thinking  │─────┘
              │     └────┬─────┘
              │          │
              │     ┌────┴──────┐
              │     │ streaming  │
              │     └────┬──────┘
              │          │
              │     ┌────┴──────┐
              │     │ executing  │
              │     └────┬──────┘
              │          │
              │     ┌────┴──────┐
              │     │  planning  │──────┐
              │     └────┬──────┘      │
              │          │             │
              │     ┌────┴─────┐       │
              │     │ completed │       │
              │     └──────────┘       │
              │                        │
              │     ┌──────────┐       │
              └─────┤  error    │◄──────┘
                    └──────────┘
```

### 6.3 Step Detail Expansion

Users can expand any step to see full details:

```
✓ Step 1: Read src/auth/index.ts
  │ Tool: Read
  │ Input: { file_path: "src/auth/index.ts" }
  │ Output: 142 lines read
  │ Duration: 0.3s
  │
  │ import { Strategy } from './strategy.js'
  │ import { Session } from './session.js'
  │ ...
  │ (140 more lines)
  └─────────────────────────
```

---

## 7. Tool Chain Visualization

### 7.1 Read Tool

**Collapsed view** (default):
```
📖 Read src/auth/index.ts · 142 lines · 0.3s
```

**Expanded view** (on select):
```
📖 Read src/auth/index.ts
├─ Input:  { file_path: "src/auth/index.ts" }
├─ Output: 142 lines, 4,523 chars
├─ Duration: 0.3s
└─ Preview:
   1 │ import { Strategy } from './strategy.js'
   2 │ import { Session } from './session.js'
   3 │ import { JWT } from './jwt.js'
   ...
   142│ export default router
```

### 7.2 Write Tool

**Collapsed view**:
```
✏️ Write src/auth/jwt.ts · 142 lines · 0.5s
```

**Expanded view**:
```
✏️ Write src/auth/jwt.ts
├─ Input:  { file_path: "src/auth/jwt.ts", content: "..." }
├─ Created: 142 lines, 3,891 chars
├─ Duration: 0.5s
└─ Preview:
   +  1 │ import jwt from 'jsonwebtoken'
   +  2 │
   +  3 │ export class JWTStrategy {
   +  4 │   constructor(private secret: string) {}
   ...
   + 142 │ }
```

### 7.3 Edit Tool

**Collapsed view**:
```
🔧 Edit src/auth/index.ts · 3 changes · 0.2s
```

**Expanded view**:
```
🔧 Edit src/auth/index.ts
├─ Input:
│  old_string: "import { Session } from './session.js'"
│  new_string: "import { JWT } from './jwt.js'"
├─ Changes: 1 replacement
├─ Duration: 0.2s
└─ Diff:
   - import { Session } from './session.js'
   + import { JWT } from './jwt.js'
```

### 7.4 Bash Tool

**Collapsed view**:
```
⚡ Bash: npm test · passed · 12.3s
```

**Expanded view**:
```
⚡ Bash: npm test
├─ Command: npm test
├─ Exit code: 0
├─ Duration: 12.3s
├─ Stdout (last 20 lines):
│  PASS src/auth/jwt.test.ts
│  PASS src/auth/middleware.test.ts
│  Tests: 47 passed, 0 failed
└─ Stderr: (empty)
```

### 7.5 Grep Tool

**Collapsed view**:
```
🔍 Grep "authenticate" in src/ · 12 matches · 0.8s
```

**Expanded view**:
```
🔍 Grep "authenticate" in src/
├─ Pattern: "authenticate"
├─ Path: src/
├─ Results: 12 matches in 5 files
├─ Duration: 0.8s
└─ Matches:
   src/auth/index.ts:15    export function authenticate(req, res) {
   src/auth/index.ts:42    const user = await authenticate(token)
   src/auth/strategy.ts:8  interface Authenticatable {
   ... (9 more)
```

### 7.6 Glob Tool

**Collapsed view**:
```
🔍 Glob "src/**/*.test.ts" · 23 files · 0.1s
```

**Expanded view**:
```
🔍 Glob "src/**/*.test.ts"
├─ Pattern: src/**/*.test.ts
├─ Results: 23 files found
├─ Duration: 0.1s
└─ Files:
   src/api/__tests__/models.test.ts
   src/api/__tests__/retry.test.ts
   src/agent/__tests__/orchestrator.test.ts
   ... (20 more)
```

### 7.7 Tool Call "Why" Context

Each tool call should show the agent's reasoning context. This is derived from the text that precedes or follows the tool call in the stream:

```
Agent: "Let me check the current authentication implementation"
  📖 Read src/auth/index.ts

Agent: "I see it uses sessions. Let me search for all auth-related files"
  🔍 Grep "authenticate" in src/

Agent: "Now I'll create the JWT replacement"
  ✏️ Write src/auth/jwt.ts
```

This is achieved by capturing the text chunks that bracket each tool call and associating them with the tool step.

---

## 8. New Status Bar Design

### 8.1 Current Status Bar (Minimal)

```
MiMo · ● Ready · 5 msgs ────────────── /home/user/project · Ctrl+C exit
```

### 8.2 New Status Bar (Rich)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ MiMo-7B-RL │ ● Running │ Iter 3 │ 5 tools │ 1,234 tok │ 2m 34s │ ~/proj │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Status Bar Fields

| Field | Content | Update Frequency |
|-------|---------|-----------------|
| Model | `MiMo-7B-RL` | On config change |
| Status | `● Running` / `● Thinking` / `● Idle` / `● Awaiting` | On phase change |
| Iteration | `Iter 3/50` | On each agent loop iteration |
| Tool Calls | `5 tools` (total this session) | On each tool call |
| Tokens | `1,234 tok` | On each API response |
| Duration | `2m 34s` (current task or session) | Every second while active |
| Directory | `~/project` (shortened) | On config change |

### 8.4 Status Bar States

**Idle state**:
```
MiMo-7B-RL │ ● Ready │ 12 tools total │ 45,678 tok │ ~/my-project
```

**Thinking state**:
```
MiMo-7B-RL │ ⠙ Thinking │ Iter 1 │ 12 tools │ 45,678 tok │ 0:03 │ ~/my-project
```

**Running tools state**:
```
MiMo-7B-RL │ ⠹ Running │ Iter 3 │ 3/15 tools │ 48,901 tok │ 1:23 │ ~/my-project
```

**Awaiting approval state**:
```
MiMo-7B-RL │ ⚠ Awaiting │ Bash: rm -rf /tmp/old │ Y/N │ ~/my-project
```

**Error state**:
```
MiMo-7B-RL │ ✗ Error │ API timeout (retry 2/3) │ 1:45 │ ~/my-project
```

### 8.5 Implementation Detail

The status bar should use a `useEffect` interval timer to update the duration every second, and subscribe to agent events for all other fields. It should be a pure component that receives all data via props:

```typescript
interface StatusBarProps {
  model: string
  phase: AgentPhase
  iteration: number
  maxIterations: number
  toolCallsTotal: number
  toolCallsActive: number
  tokenCount: number
  duration: number           // ms
  workingDir: string
  error?: string
  approvalTool?: string
}
```

---

## 9. Long Task Experience Design

### 9.30 Scenario: "Refactor the entire project architecture"

This task runs for 30+ minutes with hundreds of tool calls. The user needs to:
1. Know the task is progressing (not stuck)
2. See what phase they're in
3. Understand the overall structure
4. Be able to interrupt at any point
5. See errors and recovery

### 9.1 Progress Visualization

```
┌─ Task: Refactor project architecture ──────────────────────────────────────┐
│ Status: Running · Elapsed: 12m 34s · Phase: Executing                      │
│ Progress: [████████████░░░░░░░░░░░░░░░░░░░░░░░░] 12/40 steps              │
│ Iteration: 8/50                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Phase 1: Analysis ──────────────────── ✓ Complete (2m 12s)                 │
│   ✓ Read project structure (23 files, 1.2s)                                │
│   ✓ Analyze dependencies (5 modules, 3.4s)                                 │
│   ✓ Identify coupling points (12 issues found, 2.1s)                       │
│                                                                             │
│ Phase 2: Core refactor ─────────────── ● Running (10m 22s)                 │
│   ✓ Extract shared utilities (8 files, 45.2s)                              │
│   ✓ Restructure API layer (12 files, 1m 23s)                               │
│   ● Rewrite auth module (5/8 files done, 3m 45s)                           │
│     ● Edit src/auth/index.ts                                                │
│   ○ Update import paths                                                     │
│   ○ Fix circular dependencies                                               │
│                                                                             │
│ Phase 3: Testing ───────────────────── ○ Pending                           │
│ Phase 4: Documentation ─────────────── ○ Pending                           │
│                                                                             │
├────────────────────────────────────────────────────────────────────────────┤
│ Current: Rewriting auth module to use dependency injection...              │
│ I'm updating the auth module to use constructor injection instead of       │
│ module-level singletons. This makes testing easier and...▌                 │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Phase Breakdown

For long tasks, the agent's work is grouped into logical phases:

```typescript
interface TaskPhase {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  steps: TaskStep[]
  startedAt?: number
  completedAt?: number
  duration?: number
}
```

Phases are derived from the agent's behavior patterns:
- Consecutive reads/greps → "Analysis" phase
- Consecutive writes/edits → "Implementation" phase
- Bash commands after writes → "Verification" phase
- Final text response → "Summary" phase

### 9.3 Real-Time Status Updates

The spinner area should show dynamic, informative status:

```
⠹ Reading src/auth/index.ts (142 lines)...
⠹ Writing src/auth/jwt.ts (line 45/142)...
⠹ Running: npm test (32/47 tests passed)...
⠹ Thinking about next step (iteration 8)...
```

These messages are derived from the current step's tool call and its progress.

### 9.4 Interrupt & Resume

At any point, the user can press `Esc` to cancel. The UI shows:

```
┌─ Cancellation requested ──────────────────────────────┐
│                                                        │
│ Task was cancelled after 12m 34s                       │
│ Completed: 12/40 steps                                 │
│ Last step: Edit src/auth/index.ts (incomplete)         │
│                                                        │
│ Partial results are preserved in the conversation.     │
│ You can continue by sending a new message.             │
└────────────────────────────────────────────────────────┘
```

### 9.5 Tool Timeline View

For debugging and auditing, a compact timeline shows all tool calls:

```
Tool Timeline (15 calls, 12m 34s):
00:00  📖 Read src/index.ts .............. ✓ 0.3s
00:01  📖 Read src/auth/index.ts ......... ✓ 0.2s
00:02  🔍 Grep "import" in src/ .......... ✓ 0.8s
00:03  📖 Read src/config.ts ............. ✓ 0.1s
00:04  ✏️ Write src/auth/jwt.ts .......... ✓ 0.5s
00:05  ✏️ Write src/auth/middleware.ts .... ✓ 0.4s
00:06  🔧 Edit src/auth/index.ts ......... ✓ 0.2s
00:07  🔧 Edit src/routes/auth.ts ........ ✓ 0.3s
00:08  ⚡ Bash: npm test ................. ✗ 12.3s
00:21  📖 Read src/auth/jwt.test.ts ...... ✓ 0.2s
00:21  🔧 Edit src/auth/jwt.ts ........... ✓ 0.3s
00:22  ⚡ Bash: npm test ................. ✓ 8.7s
00:31  🔧 Edit src/auth/middleware.ts .... ✓ 0.2s
00:31  ⚡ Bash: npm test ................. ✓ 9.1s
00:41  ⚡ Bash: npm run lint ............. ✓ 3.2s
```

---

## 10. Claude Code Gap Analysis

### 10.1 Why Claude Code Feels Professional

| Dimension | Claude Code | MiMo CLI (Current) |
|-----------|-------------|---------------------|
| **Visibility** | Every tool call is visible with input/output | Tools flash and disappear |
| **Timeline** | Clear execution timeline with steps | Flat message list |
| **Control** | User can see and interrupt at any point | Only Ctrl+C, no granularity |
| **Context** | Status bar shows model, tokens, cost, directory | Shows model and 4 fields |
| **Trust** | Full audit trail of what happened | No history of actions |
| **Progress** | Step-by-step progress indicator | Single spinner |
| **Recovery** | Errors shown inline with context | Errors are just red text |
| **Continuity** | Tool results feed into next step visibly | Invisible reasoning chain |

### 10.2 The Trust Gap

The fundamental difference is **transparency**:

**Claude Code**: "Here's exactly what I'm doing, why, and what I found."
- User sees: "Reading file X to understand the import structure"
- User sees: "Found 12 imports, will need to update all of them"
- User sees: "Editing line 45 to change the import path"
- User thinks: "I understand what's happening, I trust this"

**Current MiMo CLI**: "Something is happening..."
- User sees: spinner
- User sees: brief flash of tool name
- User sees: final text response
- User thinks: "What just happened? Can I trust this?"

### 10.3 Specific Gaps

**Gap 1: No "Why" Context**

Claude Code shows the agent's reasoning before each tool call:
```
Claude: "Let me check how the auth module is currently structured"
  → Read src/auth/index.ts
```

MiMo CLI just shows the tool call:
```
📖 Read src/auth/index.ts
```

The user doesn't know why the tool was called.

**Gap 2: No Iteration Awareness**

Claude Code shows when the agent is in a multi-step loop:
```
Claude (iteration 3): Now let me update the remaining files...
```

MiMo CLI has no concept of iterations visible to the user.

**Gap 3: No Result Integration**

Claude Code shows how tool results feed into the next action:
```
Claude: "I see the file uses CommonJS. I'll adjust my approach accordingly."
  → Write src/auth/jwt.ts (using require() instead of import)
```

MiMo CLI shows tool results as disconnected blobs.

**Gap 4: No Cost/Token Awareness**

Claude Code shows token usage and estimated cost. Users can make informed decisions about when to stop. MiMo CLI has no such visibility.

**Gap 5: No Expandable Details**

Claude Code lets users expand any tool call to see full input/output. MiMo CLI truncates everything to one line.

### 10.4 Why Users Don't Trust Chat Interfaces

Chat interfaces create uncertainty because:

1. **Black box**: User sends message, waits, receives response. What happened in between?
2. **No audit trail**: Can't verify what the AI actually did
3. **No progress indication**: "Is it stuck or working?"
4. **No granularity**: Can't see individual steps, only final result
5. **No recovery visibility**: If something failed and retried, user doesn't know

The Agent Workbench model solves all five by making every step visible, auditable, and interruptible.

---

## 11. Implementation Roadmap

### Phase 1: Data Model (Foundation)

**Goal**: Replace flat `ChatEntry[]` with structured `Timeline` model

Files to create/modify:
- `src/tui/types.ts` -- add `Timeline`, `AgentTaskItem`, `TaskStep`, `ToolCallDetail`
- `src/tui/timeline.ts` -- timeline state management (pure functions)
- `src/agent/loop.ts` -- emit structured events instead of flat callbacks

Key changes:
- Define `TimelineItem`, `AgentTaskItem`, `TaskStep` types
- Create `createTask()`, `addStep()`, `updateStep()`, `completeTask()` pure functions
- Add `AgentPhase` enum and phase tracking to `AgentLoop`
- Add iteration counter to `AgentLoop`

### Phase 2: Event System

**Goal**: Replace callback soup with typed event emitter

Files to create/modify:
- `src/tui/events.ts` -- typed event emitter
- `src/agent/loop.ts` -- emit events
- `src/tui/App.tsx` -- subscribe to events

Key changes:
- Define event types: `agent:start`, `agent:thinking`, `agent:text-chunk`, `agent:tool-call`, `agent:tool-result`, `agent:iteration`, `agent:error`, `agent:complete`
- Create `EventEmitter` class with typed emit/on
- Refactor `AgentLoop.sendMessage()` to emit events
- Refactor `App.tsx` to subscribe and update timeline

### Phase 3: Timeline UI

**Goal**: Render the new timeline model

Files to create/modify:
- `src/tui/Timeline.tsx` -- main timeline container (replaces `MessageList`)
- `src/tui/AgentTask.tsx` -- task block with steps
- `src/tui/TaskStep.tsx` -- individual step (collapsible)
- `src/tui/ToolDetail.tsx` -- expanded tool view (replaces `ToolCallBlock`)
- `src/tui/App.tsx` -- wire up new components

Key changes:
- `Timeline` renders `UserMessage` and `AgentTask` items
- `AgentTask` shows header, step list, streaming text, summary
- `TaskStep` shows collapsed/expanded tool detail
- `ToolDetail` shows input, output, duration, preview
- Remove old `MessageList`, `ToolCallBlock` components

### Phase 4: Status Bar

**Goal**: Rich status bar with metrics

Files to create/modify:
- `src/tui/StatusBar.tsx` -- rewrite with all fields
- `src/tui/App.tsx` -- pass metrics to StatusBar
- `src/agent/loop.ts` -- expose token count, context usage

Key changes:
- Add token counting to API response handling
- Add context usage tracking to `ContextManager`
- Add duration timer (useEffect with interval)
- Render all 7 status fields

### Phase 5: Scroll & Layout

**Goal**: Proper scrolling and layout

Files to create/modify:
- `src/tui/ScrollContainer.tsx` -- scrollable viewport
- `src/tui/App.tsx` -- use ScrollContainer

Key changes:
- Implement scroll state (offset, viewport height)
- Auto-scroll to bottom on new content
- Allow user scroll with Page Up/Down
- Pin active task to bottom while scrolling through history

### Phase 6: Polish

**Goal**: Visual refinements and edge cases

Files to create/modify:
- `src/tui/ToolApproval.tsx` -- modal-style approval
- `src/tui/PhaseIndicator.tsx` -- phase progress visualization
- `src/tui/ToolTimeline.tsx` -- compact timeline view
- `src/tui/Welcome.tsx` -- update for new architecture

Key changes:
- Tool approval as centered modal (not inline)
- Phase progress bar
- Collapsible tool timeline
- Error recovery visualization
- Cancel confirmation dialog

---

## Appendix A: Type Definitions

```typescript
// === Timeline Model ===

interface Timeline {
  items: TimelineItem[]
  scrollOffset: number
}

type TimelineItem = UserMessageItem | AgentTaskItem

interface UserMessageItem {
  type: 'user-message'
  id: string
  content: string
  timestamp: number
}

interface AgentTaskItem {
  type: 'agent-task'
  id: string
  status: TaskStatus
  phase: AgentPhase
  steps: TaskStep[]
  streamingText: string
  finalText?: string
  startedAt: number
  completedAt?: number
  duration?: number
  iterationCount: number
  maxIterations: number
}

type TaskStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled'

type AgentPhase =
  | 'thinking'
  | 'streaming-text'
  | 'executing-tools'
  | 'awaiting-approval'
  | 'planning'
  | 'completed'
  | 'error'

// === Step Model ===

interface TaskStep {
  id: string
  type: StepType
  status: StepStatus
  label: string
  reasoning?: string           // why this step was taken
  toolCall?: ToolCallDetail
  startedAt: number
  completedAt?: number
  duration?: number
}

type StepType = 'thinking' | 'tool-call' | 'text' | 'error' | 'retry' | 'phase-change'
type StepStatus = 'pending' | 'running' | 'completed' | 'error' | 'denied'

// === Tool Detail Model ===

interface ToolCallDetail {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
  success?: boolean
  duration?: number
  summary: string
  preview?: string
  expanded: boolean
}

// === Events ===

type AgentEvent =
  | { type: 'agent:start'; taskId: string }
  | { type: 'agent:thinking'; taskId: string }
  | { type: 'agent:text-chunk'; taskId: string; chunk: string }
  | { type: 'agent:tool-call'; taskId: string; toolCall: ToolCall; args: Record<string, unknown> }
  | { type: 'agent:tool-result'; taskId: string; toolCallId: string; result: string; success: boolean; duration: number }
  | { type: 'agent:iteration'; taskId: string; iteration: number }
  | { type: 'agent:error'; taskId: string; error: string }
  | { type: 'agent:complete'; taskId: string }
  | { type: 'agent:cancel'; taskId: string }
  | { type: 'agent:retry'; taskId: string; attempt: number; delayMs: number }

// === Metrics ===

interface SessionMetrics {
  totalToolCalls: number
  totalTokens: number
  sessionDuration: number
  taskCount: number
  errorCount: number
}

interface TaskMetrics {
  toolCalls: number
  iterations: number
  duration: number
  tokensUsed: number
  stepsCompleted: number
  stepsTotal: number
}
```

## Appendix B: Migration Strategy

The refactoring should be done incrementally, with each phase producing a working application:

1. **Phase 1** can be done alongside the existing code -- new types don't break anything
2. **Phase 2** wraps the existing callbacks in an event emitter -- backward compatible
3. **Phase 3** is the big switch -- replace `MessageList` with `Timeline`
4. **Phase 4** is independent -- can be done in parallel with Phase 3
5. **Phase 5** enhances Phase 3 -- add scrolling to the new timeline
6. **Phase 6** is polish -- can be done incrementally

Each phase should be a separate PR with tests.

## Appendix C: Key Principles

1. **Completed items are immutable** -- never re-render history
2. **Only the active task updates** -- minimize render churn
3. **Every tool call is persisted** -- nothing is ephemeral
4. **Every step has a timestamp and duration** -- full auditability
5. **The user can expand any item** -- full transparency on demand
6. **The status bar is always accurate** -- single source of truth
7. **Scroll is independent of content** -- viewport doesn't fight content
8. **Phases are derived, not declared** -- the UI infers phases from behavior
9. **Errors are first-class citizens** -- shown inline, not hidden
10. **The agent's "why" is captured** -- reasoning text brackets tool calls
