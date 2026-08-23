import { AuditReportV1 } from './audit-v1.js';
export declare const AUDITOR_VERSION = "audit-v1";
export declare function cacheKey(repo: string, commit: string): string;
export declare class AuditCache {
    private readonly file;
    constructor(dataDir: string);
    load(): Promise<Record<string, {
        at: string;
        report: AuditReportV1;
    }>>;
    get(repo: string, commit: string): Promise<AuditReportV1 | null>;
    put(repo: string, commit: string, report: AuditReportV1): Promise<void>;
}
