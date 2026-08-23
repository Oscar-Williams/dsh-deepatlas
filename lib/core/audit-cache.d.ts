import { AuditReportV1 } from './audit-v1.js';
import type { PluginRecord } from './record.js';
export interface CachedAuditReport extends AuditReportV1 {
    auditedRef?: string;
    compatibility?: {
        ok: boolean;
        reasons?: string[];
    };
    pluginRecord?: PluginRecord;
}
export declare const AUDITOR_VERSION = "audit-v3";
export declare function cacheKey(repo: string, commit: string): string;
export declare class AuditCache {
    private readonly file;
    constructor(dataDir: string);
    load(): Promise<Record<string, {
        at: string;
        report: CachedAuditReport;
    }>>;
    get(repo: string, commit: string): Promise<CachedAuditReport | null>;
    put(repo: string, commit: string, report: CachedAuditReport): Promise<void>;
}
