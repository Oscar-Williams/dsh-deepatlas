/**
 * 工具:deepatlas_audit(M4)
 * 抓取目标仓库 package.json 快照,执行装前安全审计,返回分级报告。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { renderJson } from './common.js';
export declare function buildAuditTool(_ctx: Context, _config: DeepAtlasConfig): {
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
    }): Promise<{
        action: string;
        pluginRecord: import("../core/record.js").PluginRecord;
        compatibility: import("../core/compat.js").CompatibilityResult;
        target: string;
        level: import("../types.js").AuditLevel;
        findings: import("../types.js").AuditFinding[];
        scope: string[];
        commitPinned: boolean;
        auditedAt: string;
    }>;
};
