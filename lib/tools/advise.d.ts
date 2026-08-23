/**
 * 工具:deepatlas_advise(P4.1 Capability-gap Advisor)
 *
 * 安静顾问原则(评审第六轮):已有能力足够 → silent;仅当任务命中
 * 索引强候选且未安装时,给出 1-3 条建议。已装清单来自宿主
 * dump-config 行(exec 注入可测)。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { renderJson } from './common.js';
import { CapabilityInput } from '../core/capabilities.js';
export type DumpRunner = () => Promise<string>;
/** 宿主已装清单读取器(闭包绑定 profile,v0.1.1 修复硬编码 web 的不一致) */
export declare function makeDumpRunner(profile: string): DumpRunner;
export declare function buildAdviseTool(_ctx: Context, config: DeepAtlasConfig): {
    name: string;
    description: string;
    parameters: {
        task: {
            type: "string";
            required: boolean;
            description: string;
        };
        capabilities: {
            type: "array";
            items: {
                type: "string";
                enum: string[];
            };
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
        task: string;
        capabilities?: CapabilityInput;
    }, dumpFn?: DumpRunner): Promise<{
        silent: boolean;
        reason: string;
        gap?: undefined;
        recommendations?: undefined;
    } | {
        silent: boolean;
        gap: string;
        recommendations: {
            id: string;
            name: string;
            stars: number;
            quality: number;
            reason: string;
            installCommandPreview: string;
        }[];
        reason?: undefined;
    }>;
};
