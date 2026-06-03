// 流式显示增强 - token/s 指标 + 工具执行进度

import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'

interface StreamingMetricsProps {
  /** 是否正在流式输出 */
  isStreaming: boolean
  /** 已接收的字符数 */
  charCount: number
  /** 活跃工具调用数 */
  activeToolCount: number
  /** 已完成的工具调用数 */
  completedToolCount: number
  /** 总工具调用数 */
  totalToolCount: number
}

export function StreamingMetrics({
  isStreaming,
  charCount,
  activeToolCount,
  completedToolCount,
  totalToolCount,
}: StreamingMetricsProps) {
  const [charsPerSecond, setCharsPerSecond] = useState(0)
  const startTimeRef = useRef<number>(0)
  const lastCharCountRef = useRef(0)
  const lastTimeRef = useRef(0)

  useEffect(() => {
    if (isStreaming && !startTimeRef.current) {
      startTimeRef.current = Date.now()
      lastTimeRef.current = Date.now()
      lastCharCountRef.current = 0
    }

    if (!isStreaming) {
      startTimeRef.current = 0
      setCharsPerSecond(0)
      return
    }

    const now = Date.now()
    const elapsed = (now - lastTimeRef.current) / 1000

    if (elapsed >= 0.5) {
      const newChars = charCount - lastCharCountRef.current
      const cps = Math.round(newChars / elapsed)
      setCharsPerSecond(cps)
      lastCharCountRef.current = charCount
      lastTimeRef.current = now
    }
  }, [isStreaming, charCount])

  if (!isStreaming && charCount === 0 && totalToolCount === 0) return null

  const totalElapsed = startTimeRef.current
    ? Math.round((Date.now() - startTimeRef.current) / 1000)
    : 0

  return (
    <Box gap={2}>
      {isStreaming && (
        <Text color="gray" dimColor>
          {charsPerSecond} chars/s · {charCount} chars · {totalElapsed}s
        </Text>
      )}
      {totalToolCount > 0 && (
        <Text color="gray" dimColor>
          Tools: {completedToolCount}/{totalToolCount}
          {activeToolCount > 0 && ` (${activeToolCount} running)`}
        </Text>
      )}
    </Box>
  )
}

/**
 * 工具执行进度条
 */
export function ToolProgress({
  completed,
  total,
}: {
  completed: number
  total: number
}) {
  if (total === 0) return null

  const width = 20
  const filled = Math.round((completed / total) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const percent = Math.round((completed / total) * 100)

  return (
    <Box>
      <Text color="gray">[</Text>
      <Text color={completed === total ? 'green' : 'cyan'}>{bar}</Text>
      <Text color="gray">]</Text>
      <Text color="gray"> {percent}% ({completed}/{total})</Text>
    </Box>
  )
}
