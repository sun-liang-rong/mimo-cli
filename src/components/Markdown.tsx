import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

interface MarkdownProps {
  content: string;
}

function highlightCode(code: string, language: string): string {
  const lang = language.toLowerCase();

  // JS/TS family
  if (['typescript', 'ts', 'javascript', 'js', 'jsx', 'tsx'].includes(lang)) {
    return code
      .replace(/(\/\/.*$)/gm, chalk.gray('$1'))
      .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|try|catch|throw|new|typeof|interface|type|extends|implements|enum|switch|case|break|default|continue|do|in|of|yield|this|null|undefined|true|false|void|super)\b/g, chalk.magenta('$1'))
      .replace(/(["'`])(?:(?!\1).)*?\1/g, chalk.green('$&'))
      .replace(/\b(\d+\.?\d*)\b/g, chalk.yellow('$1'));
  }
  // Python
  if (['python', 'py'].includes(lang)) {
    return code
      .replace(/(#.*$)/gm, chalk.gray('$1'))
      .replace(/\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|finally|raise|with|yield|lambda|pass|break|continue|and|or|not|in|is|None|True|False|self|global|nonlocal|async|await|del|assert)\b/g, chalk.magenta('$1'))
      .replace(/(f?["']{1,3})(?:(?!\1).)*?\1/gs, chalk.green('$&'))
      .replace(/\b(\d+\.?\d*)\b/g, chalk.yellow('$1'));
  }
  // Bash/Shell
  if (['bash', 'sh', 'shell', 'zsh'].includes(lang)) {
    return code
      .replace(/(#.*$)/gm, chalk.gray('$1'))
      .replace(/\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|source|local|cd|pwd|read|test|sudo)\b/g, chalk.magenta('$1'))
      .replace(/(["'])(?:(?!\1).)*?\1/g, chalk.green('$&'))
      .replace(/\$\{?[\w]+\}?/g, chalk.cyan('$&'));
  }
  // Go
  if (lang === 'go') {
    return code
      .replace(/(\/\/.*$)/gm, chalk.gray('$1'))
      .replace(/\b(func|return|if|else|for|range|switch|case|break|default|continue|go|defer|chan|select|type|struct|interface|map|package|import|var|const|nil|true|false|error|string|int|bool|byte|make|len|append|fmt)\b/g, chalk.magenta('$1'))
      .replace(/(["'`])(?:(?!\1).)*?\1/g, chalk.green('$&'));
  }
  // Rust
  if (lang === 'rust') {
    return code
      .replace(/(\/\/.*$)/gm, chalk.gray('$1'))
      .replace(/\b(fn|let|mut|pub|impl|struct|enum|trait|mod|use|crate|self|super|match|if|else|for|while|loop|break|continue|return|as|in|ref|type|where|async|await|move|dyn|Box|Vec|String|Option|Result|Some|None|Ok|Err|true|false|unsafe)\b/g, chalk.magenta('$1'))
      .replace(/(["'])(?:(?!\1).)*?\1/g, chalk.green('$&'));
  }
  // Java
  if (lang === 'java') {
    return code
      .replace(/(\/\/.*$)/gm, chalk.gray('$1'))
      .replace(/\b(public|private|protected|class|interface|extends|implements|static|final|void|int|String|boolean|return|if|else|for|while|switch|case|break|default|new|this|super|null|true|false|try|catch|throw|throws|import|package|abstract|override)\b/g, chalk.magenta('$1'))
      .replace(/(["'])(?:(?!\1).)*?\1/g, chalk.green('$&'));
  }
  // SQL
  if (lang === 'sql') {
    return code
      .replace(/(--.*$)/gm, chalk.gray('$1'))
      .replace(/\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MAX|MIN|EXISTS|BETWEEN|LIKE|UNION|ALL|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|DEFAULT|CONSTRAINT|UNIQUE|CHECK)\b/gi, chalk.magenta('$1'))
      .replace(/(["'`])(?:(?!\1).)*?\1/g, chalk.green('$&'));
  }
  // JSON
  if (lang === 'json') {
    return code
      .replace(/"([^"]+)":/g, chalk.cyan('"$1":'))
      .replace(/: "([^"]*)"/g, ': ' + chalk.green('"$1"'))
      .replace(/: (\d+\.?\d*)/g, ': ' + chalk.yellow('$1'))
      .replace(/: (true|false|null)/g, ': ' + chalk.magenta('$1'));
  }
  // YAML
  if (lang === 'yaml' || lang === 'yml') {
    return code
      .replace(/(#.*$)/gm, chalk.gray('$1'))
      .replace(/^(\s*[\w-]+):/gm, chalk.cyan('$1:'))
      .replace(/: (.+)$/gm, (m, val) => ': ' + chalk.green(val));
  }
  // Dockerfile
  if (lang === 'dockerfile' || lang === 'docker') {
    return code
      .replace(/(#.*$)/gm, chalk.gray('$1'))
      .replace(/\b(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|WORKDIR|ENV|EXPOSE|VOLUME|ARG|LABEL|MAINTAINER|USER|HEALTHCHECK|ONBUILD)\b/g, chalk.magenta('$1'));
  }

  return code;
}

function renderInline(text: string): string {
  text = text.replace(/`([^`]+)`/g, (_, code) => chalk.bgGray.white(` ${code} `));
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, bold) => chalk.bold(bold));
  text = text.replace(/\*([^*]+)\*/g, (_, italic) => chalk.italic(italic));
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => chalk.underline.blue(label) + chalk.gray(` (${url})`));
  text = text.replace(/(?<!\()(https?:\/\/[^\s)]+)/g, (url) => chalk.underline.blue(url));
  return text;
}

function parseMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const nodes: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeLines: string[] = [];
  let key = 0;
  let inTable = false;
  let tableRows: string[][] = [];

  function flushTable() {
    if (tableRows.length === 0) return;
    nodes.push(
      <Box key={key++} flexDirection="column" marginLeft={1} marginTop={0} marginBottom={0}>
        {tableRows.map((row, ri) => (
          <Box key={ri}>
            {row.map((cell, ci) => (
              <Text key={ci} color={ri === 0 ? 'cyan' : 'white'}>{cell.padEnd(20).slice(0, 20)} </Text>
            ))}
          </Box>
        ))}
      </Box>
    );
    tableRows = [];
    inTable = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        flushTable();
        const code = highlightCode(codeLines.join('\n'), codeLanguage);
        const border = '─'.repeat(56);
        nodes.push(
          <Box key={key++} flexDirection="column" marginLeft={1} marginTop={0} marginBottom={0}>
            <Text color="gray">┌{border}┐{codeLanguage ? chalk.gray(` [${codeLanguage}]`) : ''}</Text>
            {code.split('\n').map((l, idx) => (
              <Text key={idx}><Text color="gray">│ </Text>{l}</Text>
            ))}
            <Text color="gray">└{border}┘</Text>
          </Box>
        );
        codeLines = [];
        codeLanguage = '';
        inCodeBlock = false;
      } else {
        flushTable();
        inCodeBlock = true;
        codeLanguage = line.trimStart().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) { codeLines.push(line); continue; }

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
      // Skip separator rows like |---|---|
      if (cells.every(c => /^[-:]+$/.test(c))) continue;
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith('### ')) {
      nodes.push(<Text key={key++} bold color="cyan">{line.slice(4)}</Text>);
    } else if (line.startsWith('## ')) {
      nodes.push(<Text key={key++} bold color="blue">{line.slice(3)}</Text>);
    } else if (line.startsWith('# ')) {
      nodes.push(<Text key={key++} bold color="magenta">{line.slice(2)}</Text>);
    } else if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      nodes.push(<Text key={key++} color="gray">{'─'.repeat(50)}</Text>);
    } else if (/^\s*[-*+]\s/.test(line)) {
      const match = line.match(/^(\s*)([-*+])\s(.*)/);
      if (match) {
        const indent = match[1].length > 2 ? '  ' : '';
        nodes.push(<Text key={key++}>{indent}<Text color="yellow">•</Text> {renderInline(match[3])}</Text>);
      }
    } else if (/^\s*\d+\.\s/.test(line)) {
      const match = line.match(/^(\s*)(\d+\.)\s(.*)/);
      if (match) nodes.push(<Text key={key++}>{match[1]}<Text color="yellow">{match[2]}</Text> {renderInline(match[3])}</Text>);
    } else {
      nodes.push(<Text key={key++}>{renderInline(line)}</Text>);
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    const code = highlightCode(codeLines.join('\n'), codeLanguage);
    const border = '─'.repeat(56);
    nodes.push(
      <Box key={key++} flexDirection="column" marginLeft={1}>
        <Text color="gray">┌{border}┐</Text>
        {code.split('\n').map((l, idx) => (
          <Text key={idx}><Text color="gray">│ </Text>{l}</Text>
        ))}
        <Text color="gray">└{border}┘</Text>
      </Box>
    );
  }

  flushTable();

  return nodes;
}

// Simple memoization cache to avoid re-parsing on every render
let lastParsedContent = '';
let lastParsedNodes: React.ReactNode[] = [];

export function Markdown({ content }: MarkdownProps) {
  if (content !== lastParsedContent) {
    lastParsedContent = content;
    lastParsedNodes = parseMarkdown(content);
  }
  return <Box flexDirection="column">{lastParsedNodes}</Box>;
}
