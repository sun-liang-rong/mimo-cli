// src/ui/topbar.ts

import blessed from 'blessed';
import { Colors } from './theme';

export interface TopBarState {
  model: string;
  permissionMode: string;
  version: string;
}

export class TopBar {
  readonly box: blessed.Widgets.BoxElement;

  constructor(screen: blessed.Widgets.Screen) {
    this.box = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: {
        fg: Colors.topBarFg,
        bg: Colors.topBarBg,
      },
      tags: true,
    });
  }

  update(state: TopBarState): void {
    const parts = [
      ' mimo',
      ` · ${state.model}`,
      ` · ${state.permissionMode}`,
      ` · v${state.version}`,
    ];
    this.box.setContent(parts.join(''));
    this.box.screen.render();
  }
}
