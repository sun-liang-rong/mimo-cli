// 用户输入 - Claude Code 风格：多行、历史、快捷键

import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'

interface UserInputProps {
  onSubmit: (text: string) => void
  disabled?: boolean
  showPlaceholder?: boolean
  showShortcuts?: boolean
  onToggleShortcuts?: () => void
  onCancel?: () => void
}

export function UserInput({
  onSubmit,
  disabled = false,
  showPlaceholder = false,
  showShortcuts = false,
  onToggleShortcuts,
  onCancel,
}: UserInputProps) {
  const [lines, setLines] = useState<string[]>([''])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [draft, setDraft] = useState<string[] | null>(null)

  const currentLine = lines.length - 1
  const text = lines.join('\n')

  const updateCurrentLine = useCallback(
    (updater: (line: string) => string) => {
      setLines((prev) => {
        const next = [...prev]
        next[currentLine] = updater(next[currentLine] ?? '')
        return next
      })
    },
    [currentLine]
  )

  useInput(
    (input, key) => {
      if (disabled) {
        if (key.escape && onCancel) {
          onCancel()
        }
        return
      }

      if (input === '?' && text === '' && onToggleShortcuts) {
        onToggleShortcuts()
        return
      }

      if (key.escape && onCancel) {
        onCancel()
        return
      }

      if (key.return) {
        if (key.shift) {
          setLines((prev) => [...prev, ''])
          return
        }

        if (text.trim()) {
          const trimmed = text.trim()
          onSubmit(trimmed)
          setHistory((prev) =>
            prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]
          )
          setHistoryIndex(-1)
          setDraft(null)
          setLines([''])
        }
        return
      }

      if (key.upArrow) {
        if (history.length === 0) return
        if (historyIndex === -1) {
          setDraft(lines)
          setHistoryIndex(history.length - 1)
          setLines([history[history.length - 1]!])
        } else if (historyIndex > 0) {
          const nextIndex = historyIndex - 1
          setHistoryIndex(nextIndex)
          setLines([history[nextIndex]!])
        }
        return
      }

      if (key.downArrow) {
        if (historyIndex === -1) return
        if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1
          setHistoryIndex(nextIndex)
          setLines([history[nextIndex]!])
        } else {
          setHistoryIndex(-1)
          setLines(draft ?? [''])
          setDraft(null)
        }
        return
      }

      if (key.backspace || key.delete) {
        setLines((prev) => {
          const line = prev[currentLine] ?? ''
          if (line.length > 0) {
            const next = [...prev]
            next[currentLine] = line.slice(0, -1)
            return next
          }
          if (prev.length > 1) {
            const merged = [...prev]
            const prevLine = merged.pop()!
            merged[merged.length - 1] += prevLine
            return merged
          }
          return prev
        })
        return
      }

      if (key.ctrl && input === 'c') return

      if (input && !key.ctrl && !key.meta) {
        updateCurrentLine((line) => line + input)
      }
    },
    { isActive: !disabled || !!onCancel }
  )

  return (
    <Box flexDirection="column" flexShrink={0}>
      {showShortcuts && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          marginBottom={1}
        >
          <Text bold color="yellow">Keyboard shortcuts</Text>
          <Text color="gray">  Enter         Send message</Text>
          <Text color="gray">  Shift+Enter   New line</Text>
          <Text color="gray">  ↑ / ↓         Navigate history</Text>
          <Text color="gray">  Esc           Cancel current request</Text>
          <Text color="gray">  Ctrl+C        Exit (or cancel if running)</Text>
          <Text color="gray">  /             Open command palette</Text>
        </Box>
      )}

      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, i) => (
          <Box key={i}>
            <Text color="cyan" bold>
              {'› '}
            </Text>
            {line ? (
              <>
                <Text wrap="wrap">{line}</Text>
                {i === currentLine && !disabled && (
                  <Text color="cyan">▌</Text>
                )}
              </>
            ) : i === currentLine && !disabled ? (
              <>
                {showPlaceholder && line === '' ? (
                  <Text color="gray" dimColor wrap="wrap">
                    Try "fix the failing test" or "refactor this file"…
                  </Text>
                ) : null}
                <Text color="cyan">▌</Text>
              </>
            ) : null}
          </Box>
        ))}

        {disabled && (
          <Box marginTop={0}>
            <Text color="gray" dimColor>
              {text || 'MiMo is working…'} <Text color="cyan">esc to interrupt</Text>
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}
