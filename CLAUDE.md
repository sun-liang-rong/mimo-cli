# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MiMo CLI is a terminal AI coding assistant powered by Xiaomi's MiMo large language model, inspired by Claude Code. It provides an interactive TUI (Terminal User Interface) built with Ink/React for conversational AI interactions, with built-in tools for file operations, code search, and shell command execution.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Run in development mode (uses tsx for TypeScript)
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled output
npm test             # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
```

Single test file:
```bash
npx vitest run src/tools/__tests__/diff.test.ts
```

## Architecture

### Core Flow
- **Entry Point** (`src/index.ts`): CLI argument parsing via Commander, configuration loading, routes to either setup wizard, headless mode (`-p`), or interactive TUI
- **Agent Loop** (`src/agent/loop.ts`): Central conversation loop that orchestrates API calls, tool execution, and context management. Handles streaming responses, tool approval workflow, and max iteration protection (default: 50 iterations)
- **API Client** (`src/api/client.ts`): OpenAI-compatible client for MiMo API with streaming support

### Tool System
- **Tool Registry** (`src/tools/index.ts`): Registers and manages built-in tools (Read, Write, Edit, Bash, Glob, Grep, Git)
- **Tool Interface** (`src/tools/types.ts`): Tools implement `ToolDefinition` with `execute()` method and `requiresApproval` flag
- **Approval Workflow**: Tools with `requiresApproval: true` (Write, Edit, Bash, Git) require user confirmation before execution. Read-only tools (Read, Glob, Grep) execute without approval

### Context Management
- **Context Manager** (`src/context/manager.ts`): Token-based sliding window truncation to fit within context limits
- **Token Estimation**: Uses character-based heuristic (1 token ≈ 4 chars English, 1 token ≈ 2 chars Chinese)
- **Compression Strategy**: When context exceeds 80% of limit, older messages are replaced with a summary

### TUI Layer (Ink/React)
- **App Component** (`src/tui/App.tsx`): Main interactive REPL interface
- **Setup Component** (`src/tui/Setup.tsx`): First-run configuration wizard
- Components use Ink for terminal rendering with React JSX

### Configuration
- Config stored at `~/.mimo/config.json` with API key, base URL, and model name
- Priority: CLI args > environment variables (`MIMO_API_KEY`, `MIMO_BASE_URL`, `MIMO_MODEL`) > config file

## Key Patterns

- All tool implementations follow the `ToolDefinition` interface with consistent error handling
- Agent loop uses callback pattern (`AgentCallbacks`) for streaming events to UI
- Tests use Vitest with `describe/it/expect` pattern
- TypeScript with strict mode, ESNext modules, and JSX support
