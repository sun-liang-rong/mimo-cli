// MiMo CLI 品牌色彩系统 - 统一视觉风格

/**
 * 品牌色
 */
export const BRAND_COLORS = {
  primary: 'cyan',      // 主色调 - 用于 logo、强调
  secondary: 'blue',    // 辅助色 - 用于链接、次要信息
  accent: 'yellow',     // 强调色 - 用于警告、提示
} as const

/**
 * 状态色
 */
export const STATUS_COLORS = {
  success: 'green',     // 成功、完成
  error: 'red',         // 错误、失败
  warning: 'yellow',    // 警告、需要注意
  info: 'blue',         // 信息、提示
  muted: 'gray',        // 次要、禁用
} as const

/**
 * 工具状态色
 */
export const TOOL_STATUS_COLORS = {
  running: 'cyan',      // 运行中
  completed: 'green',   // 已完成
  error: 'red',         // 错误
  denied: 'yellow',     // 已拒绝
  pending: 'gray',      // 等待中
} as const

/**
 * 上下文使用率色
 */
export function getContextUsageColor(usage: number): string {
  if (usage < 50) return 'green'
  if (usage < 70) return 'yellow'
  if (usage < 85) return 'red'
  return 'red'
}

/**
 * 上下文使用率条
 */
export function getContextUsageBar(usage: number, width: number = 10): string {
  const filled = Math.round((usage / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/**
 * 间距规范
 */
export const SPACING = {
  // 内边距
  paddingX: 1,
  paddingY: 0,
  
  // 外边距
  marginTop: 1,
  marginBottom: 1,
  marginLeft: 2,        // 缩进层级
  
  // 行间距
  lineHeight: 1,
} as const

/**
 * 图标规范
 */
export const ICONS = {
  // 状态指示
  spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  pending: '·',
  
  // UI 元素
  bullet: '•',
  arrow: '→',
  chevron: '▸',
  separator: '·',
  cursor: '▌',
} as const

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return ''
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

/**
 * 截断文本
 */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}
