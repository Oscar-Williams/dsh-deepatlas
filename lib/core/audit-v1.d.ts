/**
 * AuditReport v1(P3.5-C,采纳评审第六轮)
 *
 * 分节结构:provenance / package / sourceSignals / dependencyAudit /
 * compatibility / risk。措辞红线:源码扫描结论只称 risk signals,
 * 不称安全证明("Risk: Elevated — executes child processes")。
 *
 * v1 范围:package.json 清单层 + 至多 3 个关键文件(main 入口/
 * cordis.patch.yml)的正则信号;npm audit 子命令联动为 v1.1(当前
 * dependencyAudit 汇总清单层事实)。文件内容经 fetcher 注入以便测试。
 */
import { AuditInput } from './auditor.js';
import { AuditReport } from '../types.js';
export interface SourceSignal {
    signal: string;
    evidence: string;
    level: 'info' | 'elevated';
}
export declare function scanSourceSignals(files: Record<string, string>): SourceSignal[];
export interface AuditReportV1 extends AuditReport {
    provenance: {
        repository: string;
        commitPinned: boolean;
        archived?: boolean;
        dead?: boolean;
    };
    package_: {
        installScripts: string[];
        nativeDependencies: string[];
        dependencyCount: number;
    };
    sourceSignals: SourceSignal[];
    dependencyAudit: {
        /** v1:清单层汇总;v1.1 接 npm audit 子命令 */
        opaqueDependencies: string[];
        note: string;
    };
    risk: {
        level: 'green' | 'yellow' | 'red' | 'elevated';
        reasons: string[];
    };
}
export declare function buildAuditReportV1(input: AuditInput, files?: Record<string, string>): AuditReportV1;
