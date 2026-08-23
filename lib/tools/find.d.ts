/**
 * 工具:deepatlas_find(M3 被动推荐)
 * 检索本地索引做关键词预筛,返回候选与质量分;语义排序由 DSH 模型完成。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { Recommendation } from '../types.js';
import { renderJson } from './common.js';
export declare function buildFindTool(_ctx: Context, config: DeepAtlasConfig): {
    name: string;
    description: string;
    parameters: {
        need: {
            type: "string";
            required: boolean;
            description: string;
        };
        limit: {
            type: "number";
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
        need: string;
        limit?: number;
    }): Promise<{
        ok: boolean;
        message: string;
        need?: undefined;
        runtime?: undefined;
        candidates?: undefined;
        hint?: undefined;
    } | {
        ok: boolean;
        need: string;
        runtime: {
            platform: string;
            node: string;
            note: string;
        };
        candidates: Recommendation[];
        hint: string | undefined;
        message?: undefined;
    }>;
};
