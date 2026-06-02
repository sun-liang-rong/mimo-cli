import blessed from 'blessed';

export interface TuiComponents {
  screen: blessed.Widgets.Screen;
  topBar: blessed.Widgets.BoxElement;
  chatBox: blessed.Widgets.Log;
  taskPanel: blessed.Widgets.BoxElement;
  inputBox: blessed.Widgets.TextboxElement;
  footerBar: blessed.Widgets.BoxElement;
}

let tui: TuiComponents | null = null;

export function initTui(): TuiComponents {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'MiMo CLI',
  });

  const topBar = blessed.box({
    top: 0, left: 0, width: '100%', height: 1,
    content: ' mimo · v1.0.0',
    style: { fg: 'black', bg: 'cyan' },
    tags: true,
  });

  const taskPanel = blessed.box({
    top: 1, right: 0, width: 30, height: '100%-3',
    border: { type: 'line' },
    label: ' Tasks ',
    style: { fg: 'white', bg: '#1a1a2e', border: { fg: 'cyan' } },
    tags: true, scrollable: true, alwaysScroll: true,
  });

  const chatBox = blessed.log({
    top: 1, left: 0, width: '100%-30', height: '100%-3',
    border: { type: 'line' },
    label: ' Chat ',
    style: { fg: 'white', bg: '#0f0f23', border: { fg: 'blue' } },
    tags: true, scrollable: true, alwaysScroll: true,
  });

  const inputBox = blessed.textbox({
    bottom: 1, left: 0, width: '100%', height: 1,
    content: 'You ▸ ',
    style: { fg: 'white', bg: '#333' },
    inputOnFocus: true,
  });

  const footerBar = blessed.box({
    bottom: 0, left: 0, width: '100%', height: 1,
    content: ' default · model · Activity: idle ',
    style: { fg: 'white', bg: '#333' },
    tags: true,
  });

  screen.append(topBar);
  screen.append(chatBox);
  screen.append(taskPanel);
  screen.append(inputBox);
  screen.append(footerBar);

  screen.key(['C-c'], () => process.exit(0));

  tui = { screen, topBar, chatBox, taskPanel, inputBox, footerBar };
  return tui;
}

export function getTui(): TuiComponents | null { return tui; }
