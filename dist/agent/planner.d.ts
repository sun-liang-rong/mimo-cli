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
export declare function decomposeTask(task: string): Promise<PlanResult>;
//# sourceMappingURL=planner.d.ts.map