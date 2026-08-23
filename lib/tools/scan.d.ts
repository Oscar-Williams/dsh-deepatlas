/**
 * 工具:deepatlas_scan / deepatlas_status(M1)
 * 扫描 dsh-plugin 生态并重建本地索引;status 查看索引健康度。
 */
import { Context } from '@deepseek-ai/cordis';
import { DeepAtlasConfig } from '../config.js';
import { Scanner } from '../core/scanner.js';
import { renderJson, type ToolExecutionContext } from './common.js';
export declare function scannerFor(config: DeepAtlasConfig): Scanner;
export declare function buildScanTool(_ctx: Context, config: DeepAtlasConfig): {
    name: string;
    description: string;
    parameters: {
        confirm: {
            type: "boolean";
            required: boolean;
            description: string;
        };
        incremental: {
            type: "boolean";
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
        confirm: boolean;
        incremental?: boolean;
    }, execution?: ToolExecutionContext): Promise<{
        ok: boolean;
        pluginCount: number;
        builtAt: string;
        location: string;
        sources: import("../types.js").SourceHealth[];
    } | {
        ok: boolean;
        message: string;
    }>;
};
export declare function buildStatusTool(_ctx: Context, config: DeepAtlasConfig): {
    name: string;
    description: string;
    parameters: {};
    output: {
        schema: {
            type: "object";
            additionalProperties: true;
            properties: {};
        };
        render: typeof renderJson;
    };
    execute(): Promise<{
        githubAuth: "authenticated" | "anonymous";
        metadataCoverage: {
            enriched: number;
            total: number | undefined;
        } | undefined;
        exists: boolean;
        location: string;
        pluginCount?: undefined;
        builtAt?: undefined;
        stale?: undefined;
        sources?: undefined;
        top10?: undefined;
    } | {
        githubAuth: "authenticated" | "anonymous";
        metadataCoverage: {
            enriched: number;
            total: number | undefined;
        } | undefined;
        exists: boolean;
        location: string;
        pluginCount: number;
        builtAt: string;
        stale: boolean;
        sources: import("../types.js").SourceHealth[];
        top10: {
            name: string;
            id: string;
            stars: number;
            quality: number;
            type: import("../types.js").PluginType;
        }[];
    }>;
};
