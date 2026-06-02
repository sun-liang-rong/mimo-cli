export type ThinkingMode = 'think' | 'nothink' | 'auto';
export type PermissionMode = 'default' | 'yolo' | 'plan';
export interface MiMoConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
    maxContextTokens: number;
    thinkingMode: ThinkingMode;
    permissionMode: PermissionMode;
}
declare const DEFAULTS: MiMoConfig;
export declare function getConfig(): MiMoConfig;
export declare function get<K extends keyof MiMoConfig>(key: K): MiMoConfig[K];
export declare function set<K extends keyof MiMoConfig>(key: K, value: MiMoConfig[K]): void;
export declare function resetConfig(): void;
export declare function showConfig(): Record<string, unknown>;
export declare function isConfigured(): boolean;
export { DEFAULTS };
//# sourceMappingURL=config.d.ts.map