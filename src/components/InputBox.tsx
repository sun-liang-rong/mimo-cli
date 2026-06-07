import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme, icons } from '../display/theme.js';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
  model: string;
  cwd: string;
}

const SLASH_COMMANDS = [
  { cmd: '/plan', desc: '计划模式：先规划再执行' },
  { cmd: '/todo', desc: 'Todo 列表管理' },
  { cmd: '/help', desc: '显示帮助' },
  { cmd: '/clear', desc: '清空对话' },
  { cmd: '/compact', desc: '压缩上下文（摘要）' },
  { cmd: '/compact-smart', desc: '智能压缩' },
  { cmd: '/tools', desc: '显示工具列表' },
  { cmd: '/model', desc: '切换模型' },
  { cmd: '/memory', desc: '查看/清除记忆' },
  { cmd: '/cost', desc: '查看成本报告' },
  { cmd: '/chain', desc: '查看调用链' },
  { cmd: '/approve', desc: '切换审批模式' },
  { cmd: '/audit', desc: '查看审批日志' },
  { cmd: '/graph', desc: '构建代码图谱' },
  { cmd: '/context', desc: '重新加载项目上下文' },
  { cmd: '/sessions', desc: '历史会话' },
  { cmd: '/export', desc: '导出对话' },
  { cmd: '/quit', desc: '退出' },
];

export function InputBox({ onSubmit, isProcessing, model, cwd }: InputBoxProps) {
  const [lines, setLines] = useState<string[]>(['']);
  const [currentLine, setCurrentLine] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCommands, setShowCommands] = useState(false);

  const currentText = lines[currentLine] || '';
  const displayPath = cwd.split('/').slice(-2).join('/');

  useInput((input, key) => {
    if (isProcessing) return;

    if (key.escape) {
      setLines(['']);
      setCurrentLine(0);
      setCursorPos(0);
      setShowCommands(false);
      return;
    }

    if (key.upArrow && !key.shift) {
      if (currentLine > 0) {
        setCurrentLine(currentLine - 1);
        setCursorPos(lines[currentLine - 1]?.length || 0);
      } else if (history.length > 0) {
        const newIdx = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIdx);
        const histText = history[history.length - 1 - newIdx];
        setLines([histText]);
        setCurrentLine(0);
        setCursorPos(histText.length);
      }
      return;
    }

    if (key.downArrow && !key.shift) {
      if (currentLine < lines.length - 1) {
        setCurrentLine(currentLine + 1);
        setCursorPos(lines[currentLine + 1]?.length || 0);
      } else if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        const histText = history[history.length - 1 - newIdx];
        setLines([histText]);
        setCurrentLine(0);
        setCursorPos(histText.length);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setLines(['']);
        setCurrentLine(0);
        setCursorPos(0);
      }
      return;
    }

    if (key.return) {
      if (key.shift) {
        const newLines = [...lines];
        newLines[currentLine] = [currentText.slice(0, cursorPos), '\n', currentText.slice(cursorPos)].join('');
        const splitNewLines = newLines[currentLine].split('\n');
        const finalLines = [...newLines.slice(0, currentLine), ...splitNewLines, ...newLines.slice(currentLine + 1)];
        setLines(finalLines);
        setCurrentLine(currentLine + 1);
        setCursorPos(0);
        return;
      }

      const fullText = lines.join('\n').trim();
      if (!fullText) return;

      if (fullText.startsWith('/')) {
        setShowCommands(false);
      }

      setHistory(prev => [...prev, fullText]);
      setHistoryIndex(-1);
      setLines(['']);
      setCurrentLine(0);
      setCursorPos(0);
      onSubmit(fullText);
      return;
    }

    if (key.backspace || key.delete) {
      const newLines = [...lines];
      if (cursorPos > 0) {
        newLines[currentLine] = currentText.slice(0, cursorPos - 1) + currentText.slice(cursorPos);
        setLines(newLines);
        setCursorPos(cursorPos - 1);
      } else if (currentLine > 0) {
        const prevLine = newLines[currentLine - 1];
        newLines[currentLine - 1] = prevLine + currentText;
        newLines.splice(currentLine, 1);
        setLines(newLines);
        setCurrentLine(currentLine - 1);
        setCursorPos(prevLine.length);
      }
      const updatedText = newLines.join('\n');
      setShowCommands(updatedText.startsWith('/') && !updatedText.includes('\n'));
      return;
    }

    if (key.tab) {
      if (currentText.startsWith('/')) {
        const match = SLASH_COMMANDS.find(c => c.cmd.startsWith(currentText));
        if (match) {
          const newLines = [...lines];
          newLines[currentLine] = match.cmd + ' ';
          setLines(newLines);
          setCursorPos(match.cmd.length + 1);
          setShowCommands(false);
        }
      }
      return;
    }

    const newLines = [...lines];
    newLines[currentLine] = currentText.slice(0, cursorPos) + input + currentText.slice(cursorPos);
    setLines(newLines);
    setCursorPos(cursorPos + input.length);

    const updatedText = newLines.join('\n');
    setShowCommands(updatedText.startsWith('/') && !updatedText.includes('\n'));
  });

  const filteredCommands = currentText.startsWith('/')
    ? SLASH_COMMANDS.filter(c => c.cmd.startsWith(currentText))
    : SLASH_COMMANDS;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2} marginBottom={0} minHeight={showCommands && filteredCommands.length > 0 ? filteredCommands.length : 0}>
        {showCommands && filteredCommands.length > 0 && filteredCommands.map((c) => (
          <Text key={c.cmd}>
            <Text color="yellow">{c.cmd}</Text>
            <Text color="gray"> — {c.desc}</Text>
          </Text>
        ))}
      </Box>
      <Box marginLeft={1}>
        <Text color="cyan" bold>{icons.prompt} </Text>
        <Text color="gray">{displayPath} </Text>
        <Text color="white">
          {lines.map((line, i) => {
            if (i === currentLine) {
              return (i > 0 ? '\n' : '') + line.slice(0, cursorPos) + '│' + line.slice(cursorPos);
            }
            return (i > 0 ? '\n' : '') + line;
          }).join('')}
        </Text>
      </Box>
    </Box>
  );
}
