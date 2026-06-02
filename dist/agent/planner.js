"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decomposeTask = decomposeTask;
const ai_1 = require("../core/ai");
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
async function decomposeTask(task) {
    const planMessages = [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: `Break down this task into steps:\n\n${task}` },
    ];
    return new Promise((resolve) => {
        let planText = '';
        (0, ai_1.chatStream)(planMessages, {
            onToken: (token) => { planText += token; },
            onThinking: () => { },
            onToolCalls: () => { },
            onDone: (fullText) => {
                try {
                    const plan = parsePlan(fullText || planText);
                    resolve({ success: true, plan });
                }
                catch (err) {
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
function parsePlan(text) {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;
    const parsed = JSON.parse(jsonText);
    const steps = (parsed.steps || []).map((s, i) => ({
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
//# sourceMappingURL=planner.js.map