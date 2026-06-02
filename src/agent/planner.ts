import { chatStream } from '../core/ai';
import { ContextManager } from '../core/context';

export interface TaskPlan {
  goal: string;
  steps: Array<{
    id: number;
    description: string;
    tool: string;
    expectedOutput: string;
    confirmBefore: boolean;
  }>;
  estimatedRounds: number;
}

export interface PlanResult {
  success: boolean;
  plan?: TaskPlan;
  error?: string;
}

const PLAN_SYSTEM_PROMPT = `You are a task planning assistant. Break down the user's programming task into clear steps.

Return JSON format:
{
  "steps": [
    {
      "description": "what to do",
      "tool": "tool name (view, edit, run_command, etc.)",
      "expectedOutput": "expected result",
      "confirmBefore": true/false
    }
  ],
  "estimatedRounds": number
}`;

export async function decomposeTask(task: string): Promise<PlanResult> {
  const planMessages = [
    { role: 'system' as const, content: PLAN_SYSTEM_PROMPT },
    { role: 'user' as const, content: `Break down this task into steps:\n\n${task}` },
  ];

  return new Promise((resolve) => {
    let planText = '';

    chatStream(planMessages, {
      onToken: (token) => { planText += token; },
      onThinking: () => {},
      onToolCalls: () => {},
      onDone: (fullText) => {
        try {
          const plan = parsePlan(fullText || planText);
          resolve({ success: true, plan });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          resolve({ success: false, error: `Failed to parse plan: ${msg}` });
        }
      },
      onError: (error) => {
        resolve({ success: false, error: error.message });
      },
    });
  });
}

function parsePlan(text: string): TaskPlan {
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
  const jsonText = jsonMatch ? jsonMatch[1] : text;
  const parsed = JSON.parse(jsonText);

  const steps = (parsed.steps || []).map((s: any, i: number) => ({
    id: i + 1,
    description: String(s.description || ''),
    tool: String(s.tool || ''),
    expectedOutput: String(s.expectedOutput || ''),
    confirmBefore: Boolean(s.confirmBefore),
  }));

  return {
    goal: parsed.goal || '',
    steps,
    estimatedRounds: Number(parsed.estimatedRounds) || steps.length,
  };
}
