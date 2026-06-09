import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MessageList, MessageType } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { StatusBar } from './StatusBar.js';
import { ThinkingIndicator } from './ThinkingIndicator.js';
import { FileEditConfirm } from './FileEditConfirm.js';
import { PlanView } from './PlanView.js';
import { TodoBar } from './TodoBar.js';
import { ToolCallState } from './ToolCallBlock.js';
import { StreamBuffer } from './StreamBuffer.js';
import { AgentLoop } from '../ai/agent.js';
import { MiMoClient, ToolCall } from '../ai/client.js';
import { ConversationManager } from '../ai/conversation.js';
import { ToolRegistry } from '../tools/registry.js';
import { PermissionManager } from '../security/permissions.js';
import { PlanEngine, Plan } from '../ai/planner.js';
import { TodoManager, TodoItem } from '../ai/todo.js';
import { MemoryManager } from '../ai/memory.js';
import { CodeGraphBuilder } from '../ai/codegraph.js';
import { SubAgentManager } from '../ai/subagent.js';
import { LongTaskRunner } from '../ai/longtask.js';
import { CostController } from '../ai/cost.js';
import { registerFileTools } from '../tools/file.js';
import { registerCommandTools } from '../tools/command.js';
import { registerGitTools } from '../tools/git.js';
import { registerSystemTools } from '../tools/system.js';
import { detectProject, getProjectSummary } from '../context/project.js';
import { getRulesContext } from '../context/rules.js';
import { loadResolvedConfig, saveConfig, ApproveMode } from '../config/settings.js';
import { saveSession, listSessions, loadSession } from '../storage/history.js';
import { icons } from '../display/theme.js';
import * as fs from 'fs';

let msgIdCounter = 0;
function nextId() { return `msg_${++msgIdCounter}`; }

export function ChatView() {
  const { exit } = useApp();
  const config = loadResolvedConfig();
  const project = detectProject();

  const [messages, setMessages] = useState<MessageType[]>([]);
  const messagesRef = useRef<MessageType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState<'thinking' | 'planning' | 'executing' | 'verifying'>('thinking');
  const [thinkingTool, setThinkingTool] = useState<string | undefined>();
  const [confirmState, setConfirmState] = useState<{ toolCall: ToolCall; args: Record<string, unknown>; level: string } | null>(null);
  const [lastSigint, setLastSigint] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [memoryActive, setMemoryActive] = useState(false);
  const [costDisplay, setCostDisplay] = useState('$0.00');
  const [approveMode, setApproveMode] = useState<ApproveMode>(config.approveMode || 'smart');

  const agentRef = useRef<AgentLoop | null>(null);
  const streamBufferRef = useRef<StreamBuffer>(new StreamBuffer());
  const currentToolCallsRef = useRef<ToolCallState[]>([]);
  const streamingMsgIdRef = useRef<string>('');

  const addMessage = useCallback((msg: MessageType) => {
    messagesRef.current = [...messagesRef.current, msg];
    setMessages(messagesRef.current);
  }, []);

  if (!agentRef.current) {
    try {
      const client = new MiMoClient();
      const toolRegistry = new ToolRegistry();
      registerFileTools(toolRegistry);
      registerCommandTools(toolRegistry);
      registerGitTools(toolRegistry);

      const permissions = new PermissionManager(config.autoApprove || [], config.approveMode || 'smart');
      const planner = new PlanEngine();
      const todo = new TodoManager();
      const memory = new MemoryManager();
      const codeGraph = new CodeGraphBuilder();
      const subAgent = new SubAgentManager();
      const longTask = new LongTaskRunner();
      const cost = new CostController({
        budgetPerSession: config.budgetPerSession || 0,
        budgetMode: config.budgetMode || 'unlimited',
      });

      registerSystemTools(toolRegistry, memory, codeGraph);

      const projectSummary = getProjectSummary();
      const rulesContext = getRulesContext();
      const memoryContext = memory.getAllContext(800);
      const fullContext = [projectSummary, rulesContext, memoryContext].filter(Boolean).join('\n\n');

      const conversation = new ConversationManager({
        maxContextTokens: config.maxContextTokens,
        projectContext: fullContext,
      });

      setMemoryActive(memory.list().length > 0);
      setTodoItems(todo.list());

      const agent = new AgentLoop(client, conversation, toolRegistry, permissions, planner, todo, memory, codeGraph, subAgent, longTask, cost);
      agentRef.current = agent;

      // --- Stream buffer wiring ---
      // Mutate streaming message in place to keep array references stable,
      // then trigger re-render via setRenderKey.
      streamBufferRef.current.onFlush((content, toolCalls) => {
        const msgId = streamingMsgIdRef.current;
        if (!msgId) return;
        const msgs = messagesRef.current;
        const idx = msgs.findIndex(m => m.id === msgId);
        if (idx !== -1) {
          msgs[idx] = { ...msgs[idx], content, toolCalls: [...toolCalls] };
          messagesRef.current = [...msgs];
          setMessages(messagesRef.current);
        }
      });

      // --- Agent event handlers ---

      agent.on('thinking', () => { setThinking(true); setThinkingTool(undefined); });
      agent.on('thinking_phase', ({ phase }: { phase: 'thinking' | 'planning' | 'executing' | 'verifying' }) => { setThinkingPhase(phase); });

      agent.on('stream_start', () => {
        setThinking(false);
        streamBufferRef.current.reset();
        currentToolCallsRef.current = [];
        const msgId = nextId();
        streamingMsgIdRef.current = msgId;
        const newMsg: MessageType = { id: msgId, role: 'assistant', content: '', toolCalls: [], isStreaming: true };
        messagesRef.current = [...messagesRef.current, newMsg];
        setMessages(messagesRef.current);
      });

      agent.on('stream_delta', ({ content }: { content: string }) => {
        // IMPORTANT: do NOT call setMessages here!
        // Just append to the buffer — the flush timer will batch the update.
        streamBufferRef.current.appendContent(content);
      });

      agent.on('stream_end', () => {
        // Only flush pending buffer content. Do NOT call setMessages here —
        // onFlush already handles it, and done will set isStreaming: false.
        streamBufferRef.current.flush();
      });

      agent.on('tool_call_start', ({ toolCall, args }: { toolCall: ToolCall; args: Record<string, unknown> }) => {
        setThinking(false);
        setThinkingTool(toolCall.function.name);
        const newTc: ToolCallState = { toolCall, args, isRunning: true };
        currentToolCallsRef.current = [...currentToolCallsRef.current, newTc];
        streamBufferRef.current.updateToolCalls(currentToolCallsRef.current);
        // Force an immediate flush so tool call appears promptly
        streamBufferRef.current.flush();
      });

      agent.on('tool_confirm', ({ toolCall, args, level }: { toolCall: ToolCall; args: Record<string, unknown>; level: string }) => {
        setConfirmState({ toolCall, args, level });
        setThinkingTool(undefined);
      });

      agent.on('tool_call_result', ({ toolCall, result, duration }: { toolCall: ToolCall; result: { success: boolean; output: string; error?: string }; duration: number }) => {
        setThinkingTool(undefined);
        currentToolCallsRef.current = currentToolCallsRef.current.map(tc =>
          tc.toolCall.id === toolCall.id ? { ...tc, result, isRunning: false, duration } : tc
        );
        streamBufferRef.current.updateToolCalls(currentToolCallsRef.current);
        streamBufferRef.current.flush();
        setCostDisplay(cost.getStatusString());
      });

      agent.on('auto_compact', ({ reason }: { reason: string }) => {
        addMessage({ id: nextId(), role: 'assistant', content: `⚡ ${reason}`, toolCalls: [], isStreaming: false });
      });

      agent.on('plan_created', ({ plan }: { plan: Plan }) => { setCurrentPlan(plan); });
      agent.on('plan_confirmed', ({ plan }: { plan: Plan }) => { setCurrentPlan(plan); setTodoItems(todo.list()); });
      agent.on('plan_done', ({ plan }: { plan: Plan }) => { setCurrentPlan(plan); setTodoItems(todo.list()); });

      agent.on('done', () => {
        const msgId = streamingMsgIdRef.current;
        if (msgId) {
          const msgs = messagesRef.current;
          const idx = msgs.findIndex(m => m.id === msgId);
          if (idx !== -1) {
            msgs[idx] = {
              ...msgs[idx],
              content: streamBufferRef.current.getContent() || msgs[idx].content,
              toolCalls: [...currentToolCallsRef.current],
              isStreaming: false,
            };
            messagesRef.current = [...msgs];
            setMessages(messagesRef.current);
          }
          streamingMsgIdRef.current = '';
        }
        setIsProcessing(false);
        setThinking(false);
        setThinkingTool(undefined);
        currentToolCallsRef.current = [];
        setTodoItems(todo.list());
        setMemoryActive(memory.list().length > 0);
        setCostDisplay(cost.getStatusString());
      });

      agent.on('error', ({ message }: { message: string }) => {
        streamingMsgIdRef.current = '';
        addMessage({ id: nextId(), role: 'assistant', content: `❌ ${message}`, toolCalls: [], isStreaming: false });
        setIsProcessing(false);
        setThinking(false);
      });
    } catch (err) {
      // handled in index.ts
      void err;
    }
  }

  const handleConfirm = useCallback((approved: boolean) => {
    setConfirmState(null);
    agentRef.current?.resolveConfirm(approved);
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      const now = Date.now();
      if (now - lastSigint < 1000) {
        const conv = (agentRef.current as any)?.conversation;
        if (conv) { try { saveSession(conv.getMessagesRaw()); } catch {} }
        exit();
        return;
      }
      setLastSigint(now);
      agentRef.current?.abort();
      setIsProcessing(false);
      setThinking(false);
      setConfirmState(null);
    }
  });

  const handleSubmit = useCallback((text: string) => {
    if (text.startsWith('/')) { handleCommand(text); return; }
    addMessage({ id: nextId(), role: 'user', content: text, toolCalls: [], isStreaming: false });
    setIsProcessing(true);
    agentRef.current?.executeTask(text).catch(err => {
      addMessage({ id: nextId(), role: 'assistant', content: `❌ ${err.message}`, toolCalls: [], isStreaming: false });
      setIsProcessing(false);
    });
  }, [addMessage]);

  const handleCommand = useCallback((cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0].toLowerCase();

    switch (command) {
      case '/quit': case '/exit': {
        try { saveSession(agentRef.current?.getConversation()?.getMessagesRaw() || []); } catch {}
        exit(); break;
      }
      case '/clear':
        agentRef.current?.getConversation().clear();
        agentRef.current?.getPlanner().clear();
        messagesRef.current = [];
        setMessages([]);
        setCurrentPlan(null);
        break;
      case '/compact':
        agentRef.current?.getConversation().compact();
        addMessage({ id: nextId(), role: 'assistant', content: '✓ 上下文已压缩（摘要模式）', toolCalls: [], isStreaming: false });
        break;
      case '/compact-smart':
        agentRef.current?.getConversation().smartCompact();
        addMessage({ id: nextId(), role: 'assistant', content: '✓ 上下文已智能压缩', toolCalls: [], isStreaming: false });
        break;
      case '/help':
        addMessage({ id: nextId(), role: 'assistant', content: getHelpText(), toolCalls: [], isStreaming: false });
        break;
      case '/tools': {
        const tools = agentRef.current?.getToolRegistry()?.getDefinitions() || [];
        const list = tools.map((t: { function: { name: string; description: string } }) => `  ${icons.bullet} \`${t.function.name}\` — ${t.function.description}`).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**可用工具**\n\n${list}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/plan': {
        const task = parts.slice(1).join(' ');
        if (!task) { addMessage({ id: nextId(), role: 'assistant', content: '用法: /plan <任务描述>', toolCalls: [], isStreaming: false }); break; }
        setIsProcessing(true);
        addMessage({ id: nextId(), role: 'user', content: task, toolCalls: [], isStreaming: false });
        agentRef.current?.executePlanMode(task).then(plan => {
          if (plan) {
            setCurrentPlan(plan);
            addMessage({ id: nextId(), role: 'assistant', content: `📋 **计划已生成** (${plan.items.length} 步)\n\n输入 **y** 确认执行，**n** 取消`, toolCalls: [], isStreaming: false });
            setConfirmState({ toolCall: { id: 'plan_confirm', type: 'function', function: { name: 'plan_confirm', arguments: '{}' } }, args: {}, level: 'confirm' });
          } else {
            agentRef.current?.executeTask(task).finally(() => setIsProcessing(false));
          }
        }).catch(() => setIsProcessing(false));
        break;
      }
      case '/todo': {
        const sub = parts[1];
        const todo = agentRef.current?.getTodo();
        if (!todo) break;
        if (sub === 'done' && parts[2]) { todo.done(parts[2]); }
        else if (sub === 'skip' && parts[2]) { todo.skip(parts[2]); }
        else if (sub === 'add') { todo.add(parts.slice(2).join(' ')); }
        else if (sub === 'clear') { todo.clear(); }
        const items = todo.list();
        setTodoItems([...items]);
        const list = items.map(i => `  ${i.status === 'completed' ? '✓' : i.status === 'in_progress' ? '⟳' : '⏳'} ${i.id}: ${i.text.slice(0, 60)}`).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**Todo 列表**\n\n${list || '(空)'}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/memory': {
        const mem = agentRef.current?.getMemory();
        if (!mem) break;
        const sub = parts[1];
        if (sub === 'clear') { mem.clearAll(); setMemoryActive(false); }
        const entries = mem.list();
        const list = entries.map(e => `  [${e.scope}] **${e.key}**: ${e.value.slice(0, 60)}`).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**记忆**\n\n${list || '(空)'}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/cost': {
        const costCtrl = agentRef.current?.getCost();
        if (!costCtrl) break;
        addMessage({ id: nextId(), role: 'assistant', content: costCtrl.getReport(), toolCalls: [], isStreaming: false });
        break;
      }
      case '/chain': {
        const chain = agentRef.current?.getCallChain() || [];
        if (chain.length === 0) { addMessage({ id: nextId(), role: 'assistant', content: '暂无调用记录', toolCalls: [], isStreaming: false }); break; }
        const list = chain.map(c => `  ${c.status === 'completed' ? '✓' : '✗'} ${c.toolName} (${c.duration}ms)`).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**调用链**\n\n${list}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/approve': {
        const mode = parts[1];
        if (!['smart', 'auto', 'confirm-all'].includes(mode)) {
          addMessage({ id: nextId(), role: 'assistant', content: '用法: /approve smart|auto|confirm-all', toolCalls: [], isStreaming: false });
          break;
        }
        agentRef.current?.getPermissions().setMode(mode as ApproveMode);
        setApproveMode(mode as ApproveMode);
        saveConfig({ approveMode: mode as ApproveMode });
        addMessage({ id: nextId(), role: 'assistant', content: `✓ 审批模式: ${mode}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/audit': {
        const logs = agentRef.current?.getPermissions().getAuditLog(10) || [];
        const list = logs.map(l => { try { const e = JSON.parse(l); return `  ${e.approved ? '✓' : '✗'} ${e.tool} [${e.mode}] ${e.timestamp.slice(11, 19)}`; } catch { return ''; } }).filter(Boolean).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**审批日志**\n\n${list || '(空)'}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/context': {
        agentRef.current?.getMemory();
        addMessage({ id: nextId(), role: 'assistant', content: '✓ 项目上下文已重新加载', toolCalls: [], isStreaming: false });
        break;
      }
      case '/model':
        if (parts[1]) {
          saveConfig({ model: parts[1] });
          addMessage({ id: nextId(), role: 'assistant', content: `✓ 模型: ${parts[1]}`, toolCalls: [], isStreaming: false });
        } else {
          addMessage({ id: nextId(), role: 'assistant', content: `当前模型: ${config.model}`, toolCalls: [], isStreaming: false });
        }
        break;
      case '/sessions': {
        const sessions = listSessions();
        const list = sessions.slice(0, 10).map(s => `  ${icons.bullet} \`${s.id}\` — ${s.date.slice(0, 16)} (${s.turns}轮)`).join('\n');
        addMessage({ id: nextId(), role: 'assistant', content: `**历史会话**\n\n${list || '暂无'}`, toolCalls: [], isStreaming: false });
        break;
      }
      case '/resume': {
        const session = loadSession(parts[1]);
        if (!session) { addMessage({ id: nextId(), role: 'assistant', content: `未找到: ${parts[1]}`, toolCalls: [], isStreaming: false }); break; }
        agentRef.current?.getConversation().setMessages(session.messages);
        const resumed = session.messages.filter(m => m.role === 'user' || (m.role === 'assistant' && m.content)).map(m => ({ id: nextId(), role: m.role as 'user' | 'assistant', content: m.content || '', toolCalls: [], isStreaming: false }));
        messagesRef.current = resumed;
        setMessages(resumed);
        break;
      }
      case '/export': {
        const conv = agentRef.current?.getConversation();
        if (conv) { const md = sessionToMarkdown(conv.getMessagesRaw()); const p = `mimo-export-${Date.now()}.md`; fs.writeFileSync(p, md); addMessage({ id: nextId(), role: 'assistant', content: `✓ 导出到 ${p}`, toolCalls: [], isStreaming: false }); }
        break;
      }
      case '/graph': {
        const graph = agentRef.current?.getCodeGraph();
        if (graph) { graph.build(); const ctx = graph.getContextString(); addMessage({ id: nextId(), role: 'assistant', content: `✓ 代码图谱已构建\n\n${ctx}`, toolCalls: [], isStreaming: false }); }
        break;
      }
      default:
        addMessage({ id: nextId(), role: 'assistant', content: `未知命令: ${command}。/help 查看帮助`, toolCalls: [], isStreaming: false });
    }
  }, [config.model, exit, addMessage]);

  const handlePlanConfirm = useCallback((approved: boolean) => {
    setConfirmState(null);
    if (approved && currentPlan) {
      agentRef.current?.getPlanner().confirmPlan();
      agentRef.current?.executeConfirmedPlan(currentPlan).finally(() => setIsProcessing(false));
    } else {
      setCurrentPlan(null);
      setIsProcessing(false);
      addMessage({ id: nextId(), role: 'assistant', content: '计划已取消', toolCalls: [], isStreaming: false });
    }
  }, [currentPlan, addMessage]);

  const tokenInfo = agentRef.current?.getConversation().getContextSummary() || { tokens: 0, maxTokens: config.maxContextTokens, turns: 0 };
  const planPercent = agentRef.current?.getPlanner().getProgress().percent;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginLeft={2} marginBottom={0}>
        <Text color="cyan" bold>╭──────────────────────────────────────╮</Text>
        <Box><Text color="cyan" bold>│  </Text><Text color="cyan" bold>MiMo CLI v2.0</Text><Text color="gray"> — AI 编程助手           </Text><Text color="cyan" bold>│</Text></Box>
        <Text color="cyan" bold>╰──────────────────────────────────────╯</Text>
        {project.type !== 'unknown' && <Text color="gray">  项目: {project.name} ({project.language})</Text>}
        <Text color="gray">  /help 帮助 | /plan 计划模式 | Ctrl+C×2 退出</Text>
        <Text> </Text>
      </Box>

      <PlanView plan={currentPlan} />

      <Box flexDirection="column">
        <MessageList messages={messages} />
        <ThinkingIndicator visible={thinking} phase={thinkingPhase} toolName={thinkingTool} />
        {confirmState && (
          confirmState.toolCall.function.name === 'plan_confirm' ? (
            <FileEditConfirm fileName="执行计划" oldText="" newText="" level="confirm" onConfirm={handlePlanConfirm} />
          ) : (
            <FileEditConfirm
              fileName={String(confirmState.args.path || confirmState.toolCall.function.name)}
              oldText={String(confirmState.args.old_string || '')}
              newText={String(confirmState.args.new_string || '')}
              level={confirmState.level as 'confirm' | 'dangerous'}
              onConfirm={handleConfirm}
            />
          )
        )}
      </Box>

      <TodoBar items={todoItems} />

      <Box flexDirection="column">
        {!isProcessing && !confirmState && (
          <InputBox onSubmit={handleSubmit} isProcessing={isProcessing} model={config.model} cwd={process.cwd()} />
        )}
        <StatusBar
          model={config.model} tokens={tokenInfo.tokens} maxTokens={tokenInfo.maxTokens}
          projectType={project.type} isProcessing={isProcessing} turnCount={tokenInfo.turns}
          cost={costDisplay} approveMode={approveMode} planPercent={planPercent} memoryActive={memoryActive}
        />
      </Box>
    </Box>
  );
}

function getHelpText(): string {
  return `**📖 命令列表**

${icons.bullet} \`/plan <task>\` — 计划模式：先规划再执行
${icons.bullet} \`/todo\` — 查看/管理 Todo 列表
${icons.bullet} \`/memory\` — 查看/清除 Memory
${icons.bullet} \`/cost\` — 查看成本报告
${icons.bullet} \`/chain\` — 查看调用链
${icons.bullet} \`/approve smart|auto|confirm-all\` — 切换审批模式
${icons.bullet} \`/audit\` — 查看审批日志
${icons.bullet} \`/graph\` — 构建/查看代码图谱
${icons.bullet} \`/context\` — 重新加载项目上下文
${icons.bullet} \`/compact\` / \`/compact-smart\` — 压缩上下文
${icons.bullet} \`/tools\` — 显示可用工具
${icons.bullet} \`/model [name]\` — 查看/切换模型
${icons.bullet} \`/sessions\` / \`/resume <id>\` — 会话管理
${icons.bullet} \`/export\` — 导出对话
${icons.bullet} \`/clear\` — 清空对话
${icons.bullet} \`/quit\` — 退出

**快捷键**
${icons.bullet} Ctrl+C — 中断 / Ctrl+C×2 — 退出
${icons.bullet} Shift+Enter — 多行换行
${icons.bullet} ↑/↓ — 历史输入 | Tab — 补全`;
}

function sessionToMarkdown(messages: { role: string; content: string | null }[]): string {
  let md = '# MiMo CLI 对话历史\n\n';
  for (const msg of messages) {
    if (msg.role === 'user') md += `## 👤 用户\n${msg.content}\n\n`;
    else if (msg.role === 'assistant') md += `## 🤖 MiMo\n${msg.content || ''}\n\n`;
  }
  return md;
}
