export declare function registerFileTools(): void;
export declare function readFile(filePath: string): {
    success: boolean;
    content?: string;
    error?: string;
};
export declare function writeFile(filePath: string, content: string): {
    success: boolean;
    error?: string;
};
export declare function showDiff(filePath: string): {
    success: boolean;
    diff?: string;
    error?: string;
};
export declare function getLanguageFromExt(filePath: string): string;
//# sourceMappingURL=file.d.ts.map