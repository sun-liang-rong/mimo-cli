export interface TaskInfo {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
}
export declare function initLayout(): void;
export declare function renderTopBar(): void;
export declare function renderFooterBar(usage?: {
    total_tokens: number;
}): void;
export declare function setActivityStatus(status: 'idle' | 'thinking' | 'tool_call'): void;
export declare function appendChat(content: string): void;
export declare function clearChat(): void;
export declare function refreshTaskPanel(tasks: TaskInfo[]): void;
export declare function startInputLoop(callback: (text: string) => void): void;
export declare function continueInputLoop(): void;
export declare function stopInputLoop(): void;
export declare function getLayout(): {
    screen: null;
    chatBox: null;
    taskPanel: null;
    inputLine: null;
};
export declare function refreshAll(usage?: {
    total_tokens: number;
}): void;
export declare function getCurrentTasks(): TaskInfo[];
export declare function renderTaskResult(name: string, success: boolean): void;
//# sourceMappingURL=layout.d.ts.map