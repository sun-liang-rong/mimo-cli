export interface ProjectIndex {
    files: {
        source: string[];
        config: string[];
        test: string[];
        docs: string[];
    };
    symbols: Array<{
        name: string;
        type: 'function' | 'class' | 'interface' | 'variable';
        file: string;
        line: number;
    }>;
    meta: {
        language: string;
        framework?: string;
        packageManager: string;
    };
}
export declare function buildProjectIndex(cwd?: string): ProjectIndex;
export declare function saveIndex(index: ProjectIndex, cwd?: string): void;
export declare function loadIndex(cwd?: string): ProjectIndex | null;
//# sourceMappingURL=index.d.ts.map