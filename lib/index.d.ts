/**
 * DeepAtlas for DeepSeek Harness(dsh-插件导航)
 *
 * 任务感知的 DSH 插件生态导航:经用户确认后扫描 dsh-plugin 生态并建立本地索引,
 * 在当前会话中按需推荐插件,装前安全审计,获得用户明确授权后才安装。
 *
 * 遵循 DSH 正式外部插件规范(dev.to 教程 / docs/cookbook/adding-a-package.md):
 * 命名导出 name / inject / Config / apply。
 */
import { Context } from '@deepseek-ai/cordis';
import { Config, DeepAtlasConfig } from './config.js';
export declare const name = "dsh-deepatlas";
export declare const inject: string[];
export { Config };
export type { DeepAtlasConfig };
export declare function apply(ctx: Context, config: DeepAtlasConfig): void;
