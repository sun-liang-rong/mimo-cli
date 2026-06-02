import { TaskPlan } from './planner';

export interface ExecutionResult {
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  output: string;
  error?: string;
}

export async function executePlan(
  plan: TaskPlan,
  callbacks: {
    onStepStart: (step: number, total: number) => void;
    onStepComplete: (step: number, total: number, success: boolean) => void;
    onConfirm: (description: string) => Promise<boolean>;
  },
): Promise<ExecutionResult> {
  let currentStep = 0;
  const maxRounds = 20;

  while (currentStep < plan.steps.length && currentStep < maxRounds) {
    const step = plan.steps[currentStep];
    callbacks.onStepStart(currentStep + 1, plan.steps.length);

    if (step.confirmBefore) {
      const confirmed = await callbacks.onConfirm(step.description);
      if (!confirmed) {
        return {
          success: false,
          completedSteps: currentStep,
          totalSteps: plan.steps.length,
          output: 'User cancelled',
        };
      }
    }

    // Simulate step execution (actual tool execution is handled by the caller)
    currentStep++;
    callbacks.onStepComplete(currentStep, plan.steps.length, true);
  }

  return {
    success: currentStep >= plan.steps.length,
    completedSteps: currentStep,
    totalSteps: plan.steps.length,
    output: `Completed ${currentStep}/${plan.steps.length} steps`,
  };
}
