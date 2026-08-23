/**
 * 兼容性闸门(P2):运行时事实 vs 插件要求
 *
 * RuntimeInfo 来自当前进程(process.*);PluginRecord 的引擎/native/构建
 * 要求来自目标插件 package.json(经 auditor/record 抽取)。
 * checkCompatibility 输出可解释结论,供推荐卡与安装闸门共用。
 */
/** 迷你 semver:覆盖 engines 常见形态(exact、脱字号、波浪号、比较符、星号、双竖线联合) */
export declare function satisfiesRange(version: string, range: string): boolean;
export interface RuntimeInfo {
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    packageManager: 'pnpm' | 'npm' | 'unknown';
    /** DSH 版本,读不到为 unknown(P3 接入启动上下文) */
    dshVersion: string;
}
export declare function getRuntimeInfo(): RuntimeInfo;
export interface CompatibilityRequirement {
    /** engines.node 原文,如 "^22.19.0 || >=24.0.0" */
    enginesNode?: string;
    /** 已知 native addon 依赖(koffi/node-pty 等) */
    nativeDependencies: string[];
    /** 是否含安装期构建脚本(prepare/preinstall/postinstall) */
    buildScripts: string[];
}
export interface CompatibilityResult {
    /** ok=true 可进入推荐/安装候选;false 为硬性不兼容 */
    ok: boolean;
    node: {
        pass: boolean | 'unknown';
        detail: string;
    };
    platform: {
        note: string;
    };
    build: {
        required: boolean;
        note: string;
    };
    reasons: string[];
}
export declare function checkCompatibility(req: CompatibilityRequirement, runtime: RuntimeInfo): CompatibilityResult;
