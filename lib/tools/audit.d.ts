/**
 * 工具:deepatlas_audit(M4)
 * 抓取目标仓库 package.json 快照,执行装前安全审计,返回分级报告。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { renderJson, type ToolExecutionContext } from './common.js';
export declare function buildAuditTool(_ctx: Context, config: DeepAtlasConfig): {
    name: string;
    description: string;
    parameters: {
        target: {
            type: "string";
            required: boolean;
            description: string;
        };
        commit: {
            type: "string";
            description: string;
        };
    };
    output: {
        schema: {
            type: "object";
            additionalProperties: true;
            properties: {};
        };
        render: typeof renderJson;
    };
    execute(args: {
        target: string;
        commit?: string;
    }, execution?: ToolExecutionContext): Promise<{
        ok: boolean;
        level: string;
        action: string;
    } | {
        action: string;
        auditedRef?: string;
        compatibility?: {
            ok: boolean;
            reasons?: string[];
        };
        pluginRecord?: import("../core/record.js").PluginRecord;
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
        sourceSignals: import("../core/audit-v1.js").SourceSignal[];
        dependencyAudit: {
            opaqueDependencies: string[];
            note: string;
        };
        risk: {
            level: "green" | "yellow" | "red" | "elevated";
            reasons: string[];
        };
        target: string;
        level: import("../types.js").AuditLevel;
        findings: import("../types.js").AuditFinding[];
        scope: string[];
        commitPinned: boolean;
        auditedAt: string;
    }>;
};
