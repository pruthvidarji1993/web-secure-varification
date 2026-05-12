import { Issue } from './types';
export interface IgnoreConfig {
    ignoredFiles: Set<string>;
    ignoredScanners: Set<string>;
    ignoredRuleIds: Set<string>;
    ignoredFilePatterns: RegExp[];
}
export declare function loadIgnoreConfig(projectPath: string, ignoreFilePath?: string): IgnoreConfig;
export declare function shouldIgnoreIssue(issue: Issue, ignoreConfig: IgnoreConfig): boolean;
export declare function applyInlineIgnores(content: string, issues: Issue[], filePath: string, projectPath: string): Issue[];
//# sourceMappingURL=ignore.d.ts.map