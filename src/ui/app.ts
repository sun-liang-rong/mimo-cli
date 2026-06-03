// src/ui/app.ts

import blessed from 'blessed';
import { EventEmitter } from 'events';
import os from 'os';
import { TopBar, TopBarState } from './topbar';
import { FooterBar } from './footerbar';
import { ChatBox } from './chatbox';
import { InputBox } from './inputbox';
import { StreamRenderer } from './stream-renderer';
import { PermissionUI } from './permission-ui';

export interface TUIAppOptions {
  model: string;
  permissionMode: string;
  version: string;
}

export class TUIApp extends EventEmitter {
  private screen: blessed.Widgets.Screen;
  private topbar: TopBar;
  private footerbar: FooterBar;
  private chatbox: ChatBox;
  private inputbox: InputBox;
  private streamRenderer: StreamRenderer;
  private permissionUI: PermissionUI;
  private options: TUIAppOptions;

  constructor(options: TUIAppOptions) {
    super();
    this.options = options;

    // 创建 blessed Screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'MiMo CLI',
      fullUnicode: true,
      dockBorders: true,
    });

    // 创建组件
    this.topbar = new TopBar(this.screen);
    this.footerbar = new FooterBar(this.screen);
    this.chatbox = new ChatBox(this.screen);
    this.inputbox = new InputBox({ screen: this.screen });
    this.streamRenderer = new StreamRenderer(this.chatbox, this.footerbar, this.screen);
    this.permissionUI = new PermissionUI(this.chatbox, this.inputbox);

    // 初始化 TopBar
    this.topbar.update({
      model: options.model,
      permissionMode: options.permissionMode,
      version: options.version,
    });

    // 初始化 FooterBar
    this.footerbar.updateInfo(options.model, options.permissionMode);

    // 绑定事件
    this.bindEvents();
  }

  /** 启动 TUI */
  start(): void {
    // 显示欢迎信息
    const username = os.userInfo().username;
    this.chatbox.pushText('{cyan-fg}{bold}MiMo CLI{/bold}{/cyan-fg}');
    this.chatbox.pushText(`{gray-fg}Welcome, ${username}. Type a message to start.{/gray-fg}`);
    this.chatbox.pushText('{gray-fg}/help for commands{/gray-fg}');
    this.chatbox.pushText('');

    // 激活输入
    this.inputbox.activate();
    this.screen.render();
  }

  /** 停止 TUI */
  stop(): void {
    this.inputbox.deactivate();
    this.screen.destroy();
  }

  /** 获取 StreamRenderer (供 chat.ts 使用) */
  getStreamRenderer(): StreamRenderer {
    return this.streamRenderer;
  }

  /** 获取 ChatBox */
  getChatBox(): ChatBox {
    return this.chatbox;
  }

  /** 获取 InputBox */
  getInputBox(): InputBox {
    return this.inputbox;
  }

  /** 获取 FooterBar */
  getFooterBar(): FooterBar {
    return this.footerbar;
  }

  /** 获取 PermissionUI */
  getPermissionUI(): PermissionUI {
    return this.permissionUI;
  }

  /** 更新 TopBar 状态 */
  updateTopBar(state: TopBarState): void {
    this.topbar.update(state);
  }

  /** 绑定事件 */
  private bindEvents(): void {
    // 输入提交
    this.inputbox.on('submit', (text: string) => {
      this.emit('input', text);
    });

    // 退出
    this.inputbox.on('quit', () => {
      this.emit('quit');
    });

    // 清屏
    this.inputbox.on('clear', () => {
      this.chatbox.clear();
      this.emit('clear');
    });

    // 取消
    this.inputbox.on('cancel', () => {
      this.emit('cancel');
    });

    // Tab 补全
    this.inputbox.on('tabComplete', (partial: string) => {
      this.emit('tabComplete', partial);
    });

    // 全局 Ctrl+C (备用)
    this.screen.key(['C-c'], () => {
      this.emit('quit');
    });
  }
}
