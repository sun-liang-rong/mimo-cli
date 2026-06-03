// 终端加载动画

import React, { useState, useEffect } from 'react'
import { Text } from 'ink'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface SpinnerProps {
  label?: string
  color?: string
}

export function Spinner({ label, color = 'yellow' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Text color={color}>
      {FRAMES[frame]}
      {label ? ` ${label}` : ''}
    </Text>
  )
}
