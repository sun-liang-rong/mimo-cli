import { TaskPlan } from './planner';
export interface ExecutionResult {
    success: boolean;
    completedSteps: number;
    totalSteps: number;
    output: string;
    error?: string;
}
export declare function executePlan(plan: TaskPlan, callbacks: {
    onStepStart: (step: number, total: number) => void;
    onStepComplete: (step: number, total: number, success: boolean) => void;
    onConfirm: (description: string) => Promise<boolean>;
}): Promise<ExecutionResult>;
//# sourceMappingURL=executor.d.ts.map