import { Report, ScanOptions, ScanResult } from './types';
type ScannerFn = (projectPath: string) => Promise<ScanResult>;
declare const ALL_SCANNERS: Record<string, ScannerFn>;
export { ALL_SCANNERS };
export declare function runScan(options: ScanOptions): Promise<Report>;
//# sourceMappingURL=scanner.d.ts.map