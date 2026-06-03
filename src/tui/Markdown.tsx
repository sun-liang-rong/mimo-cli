// Markdown 渲染组件 (增强版: 支持表格/链接/引用/嵌套列表)

import React from 'react'
import { Box, Text } from 'ink'
import { highlight } from 'cli-highlight'

interface MarkdownProps {
  content: string
  maxLines?: number
}

export function Markdown({ content, maxLines }: MarkdownProps) {
  const lines = content.split('\n')
  const rendered: React.ReactNode[] = []

  let inCodeBlock = false
  let codeLanguage = ''
  let codeLines: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let tableHeaders: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 代码块处理
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        rendered.push(
          <CodeBlock key={`code-${i}`} code={codeLines.join('\n')} language={codeLanguage} />
        )
        codeLines = []
        codeLanguage = ''
        inCodeBlock = false
      } else {
        codeLanguage = line.slice(3).trim()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // 表格处理
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(Boolean)

      // 分隔行 (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        inTable = true
        continue
      }

      if (!inTable) {
        // 第一行是表头
        tableHeaders = cells
        inTable = true
        continue
      }

      tableRows.push(cells)
      continue
    } else if (inTable) {
      // 表格结束，渲染
      rendered.push(
        <TableBlock key={`table-${i}`} headers={tableHeaders} rows={tableRows} />
      )
      inTable = false
      tableHeaders = []
      tableRows = []
    }

    // 引用块
    if (line.startsWith('> ')) {
      rendered.push(
        <Box key={i} borderStyle="single" borderColor="gray" paddingLeft={1}>
          <Text color="gray" italic>{renderInline(line.slice(2))}</Text>
        </Box>
      )
      continue
    }
    if (line === '>') {
      rendered.push(
        <Box key={i} borderStyle="single" borderColor="gray" paddingLeft={1}>
          <Text> </Text>
        </Box>
      )
      continue
    }

    // 标题
    if (line.startsWith('# ')) {
      rendered.push(
        <Text key={i} bold color="cyan">{line.slice(2)}</Text>
      )
      continue
    }
    if (line.startsWith('## ')) {
      rendered.push(
        <Text key={i} bold color="blue">{line.slice(3)}</Text>
      )
      continue
    }
    if (line.startsWith('### ')) {
      rendered.push(
        <Text key={i} bold>{line.slice(4)}</Text>
      )
      continue
    }
    if (line.startsWith('#### ')) {
      rendered.push(
        <Text key={i} bold dimColor>{line.slice(5)}</Text>
      )
      continue
    }

    // 水平线
    if (/^[-*_]{3,}$/.test(line.trim())) {
      rendered.push(
        <Text key={i} color="gray">{'─'.repeat(40)}</Text>
      )
      continue
    }

    // 嵌套列表 (支持 1. 2. 3. 和 - * +)
    const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (orderedMatch) {
      const [, indent, num, text] = orderedMatch
      const depth = Math.floor((indent?.length || 0) / 2)
      rendered.push(
        <Text key={i}>
          {'  '.repeat(depth)}{num}. {renderInline(text)}
        </Text>
      )
      continue
    }

    const unorderedMatch = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      const [, indent, text] = unorderedMatch
      const depth = Math.floor((indent?.length || 0) / 2)
      const bullet = depth === 0 ? '•' : depth === 1 ? '◦' : '▪'
      rendered.push(
        <Text key={i}>
          {'  '.repeat(depth)}{bullet} {renderInline(text)}
        </Text>
      )
      continue
    }

    // 复选框列表
    const checkboxMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (checkboxMatch) {
      const [, indent, checked, text] = checkboxMatch
      const depth = Math.floor((indent?.length || 0) / 2)
      const icon = checked === ' ' ? '☐' : '☑'
      rendered.push(
        <Text key={i} color={checked === ' ' ? 'gray' : 'green'}>
          {'  '.repeat(depth)}{icon} {renderInline(text)}
        </Text>
      )
      continue
    }

    // 空行
    if (line.trim() === '') {
      rendered.push(<Text key={i}> </Text>)
      continue
    }

    // 普通文本
    rendered.push(
      <Text key={i} wrap="wrap">{renderInline(line)}</Text>
    )
  }

  // 处理未关闭的表格
  if (inTable && tableHeaders.length > 0) {
    rendered.push(
      <TableBlock key="table-end" headers={tableHeaders} rows={tableRows} />
    )
  }

  // Apply maxLines truncation (cap rendered output to N top-level children)
  let final = rendered
  if (maxLines != null && maxLines > 0 && rendered.length > maxLines) {
    const truncated = rendered.slice(0, maxLines)
    truncated.push(
      <Text key="__truncated" color="gray" dimColor>
        … (truncated, {rendered.length - maxLines} more line{rendered.length - maxLines === 1 ? '' : 's'})
      </Text>
    )
    final = truncated
  }

  return <>{final}</>
}

function renderInline(text: string): React.ReactNode {
  // 处理链接 [text](url)
  const linkParts = text.split(/(\[[^\]]+\]\([^)]+\))/)
  if (linkParts.length > 1) {
    return linkParts.map((part, i) => {
      const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (linkMatch) {
        return (
          <Text key={i} color="blue" underline>
            {linkMatch[1]}
          </Text>
        )
      }
      return renderInlineFormatting(part, i)
    })
  }

  return renderInlineFormatting(text, 0)
}

function renderInlineFormatting(text: string, baseKey: number): React.ReactNode {
  // 处理内联代码
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Text key={`${baseKey}-${i}`} backgroundColor="gray" color="white">
          {part.slice(1, -1)}
        </Text>
      )
    }

    // 处理粗体 + 斜体
    const boldItalicParts = part.split(/(\*\*\*[^*]+\*\*\*)/)
    if (boldItalicParts.length > 1) {
      return boldItalicParts.map((bp, j) => {
        if (bp.startsWith('***') && bp.endsWith('***')) {
          return (
            <Text key={`${baseKey}-${i}-${j}`} bold italic>
              {bp.slice(3, -3)}
            </Text>
          )
        }
        return renderBold(bp, `${baseKey}-${i}-${j}`)
      })
    }

    return renderBold(part, `${baseKey}-${i}`)
  })
}

function renderBold(text: string, key: string): React.ReactNode {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/)
  if (boldParts.length > 1) {
    return boldParts.map((bp, j) => {
      if (bp.startsWith('**') && bp.endsWith('**')) {
        return (
          <Text key={`${key}-${j}`} bold>
            {bp.slice(2, -2)}
          </Text>
        )
      }
      return renderItalic(bp, `${key}-${j}`)
    })
  }
  return renderItalic(text, key)
}

function renderItalic(text: string, key: string): React.ReactNode {
  const italicParts = text.split(/(\*[^*]+\*)/)
  if (italicParts.length > 1) {
    return italicParts.map((ip, j) => {
      if (ip.startsWith('*') && ip.endsWith('*') && ip.length > 2) {
        return (
          <Text key={`${key}-${j}`} italic>
            {ip.slice(1, -1)}
          </Text>
        )
      }
      return <React.Fragment key={`${key}-${j}`}>{ip}</React.Fragment>
    })
  }
  return <React.Fragment key={key}>{text}</React.Fragment>
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  try {
    const highlighted = highlight(code, {
      language: language || undefined,
      ignoreIllegals: true,
    })
    return (
      <Box flexDirection="column" paddingX={2}>
        {language && (
          <Text color="gray" dimColor>[{language}]</Text>
        )}
        <Text>{highlighted}</Text>
      </Box>
    )
  } catch {
    return (
      <Box flexDirection="column" paddingX={2}>
        {language && (
          <Text color="gray" dimColor>[{language}]</Text>
        )}
        <Text>{code}</Text>
      </Box>
    )
  }
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  // 计算列宽
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0)
    return Math.max(h.length, maxRow, 3)
  })

  const padCell = (text: string, width: number) => text.padEnd(width)

  const separator = '┼' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┼'
  const topBorder = '┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐'
  const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘'

  return (
    <Box flexDirection="column">
      <Text color="gray">{topBorder}</Text>
      <Text>
        <Text color="gray">│</Text>
        {headers.map((h, i) => (
          <React.Fragment key={i}>
            <Text bold> {padCell(h, colWidths[i])} </Text>
            <Text color="gray">│</Text>
          </React.Fragment>
        ))}
      </Text>
      <Text color="gray">{separator}</Text>
      {rows.map((row, ri) => (
        <Text key={ri}>
          <Text color="gray">│</Text>
          {row.map((cell, ci) => (
            <React.Fragment key={ci}>
              <Text> {padCell(cell, colWidths[ci])} </Text>
              <Text color="gray">│</Text>
            </React.Fragment>
          ))}
        </Text>
      ))}
      <Text color="gray">{bottomBorder}</Text>
    </Box>
  )
}
