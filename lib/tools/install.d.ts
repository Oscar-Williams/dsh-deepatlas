/**
 * 工具:deepatlas_install(M5/P3)
 * 接入 InstallPlan 状态机:approve(四重闸门)→ checkDuplicate(装前查重)
 * → install(真实/dry-run)→ verifyComposed(dump-config 断言)。
 * BOOT_VERIFIED/ACTIVE 由外部冒烟脚本推进(工具进程内不宜再起宿主)。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { AuditLevel } from '../types.js';
import { renderJson } from './common.js';
import { InstallPlan } from '../core/installplan.js';
export declare function buildInstallTool(_ctx: Context, config: DeepAtlasConfig): {
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
            required: boolean;
            description: string;
        };
        auditLevel: {
            type: "string";
            required: boolean;
            description: string;
        };
        userConsent: {
            type: "boolean";
            required: boolean;
            description: string;
        };
        enginesNode: {
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
        commit: string;
        auditLevel: AuditLevel;
        userConsent: boolean;
        enginesNode?: string;
    }): Promise<{
        ok: boolean;
        plan: InstallPlan;
    }>;
};
