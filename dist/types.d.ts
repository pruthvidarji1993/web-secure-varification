export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface Issue {
    id: string;
    title: string;
    description: string;
    severity: Severity;
    scanner: string;
    file?: string;
    line?: number;
    fix?: string;
    fixable?: boolean;
    fixCommand?: string;
    references?: string[];
    metadata?: Record<string, unknown>;
    ruleId?: string;
}
export interface ScanResult {
    scanner: string;
    issues: Issue[];
    duration: number;
    error?: string;
}
export interface Report {
    projectPath: string;
    projectName: string;
    scannedAt: string;
    duration: number;
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        total: number;
    };
    results: ScanResult[];
}
export interface ScanOptions {
    path: string;
    format: 'console' | 'json' | 'html' | 'markdown' | 'sarif';
    output?: string;
    severity: Severity;
    skip: string[];
    config?: string;
    fix?: boolean;
    failOn?: Severity[];
    ignoreFile?: string;
}
export interface WsvConfig {
    skip?: string[];
    severity?: Severity;
    format?: 'console' | 'json' | 'html' | 'markdown' | 'sarif';
    output?: string;
    ignorePatterns?: string[];
    failOn?: Severity[];
}
export interface IgnoreRule {
    type: 'file' | 'scanner' | 'rule' | 'pattern';
    value: string;
    comment?: string;
}
//# sourceMappingURL=types.d.ts.map