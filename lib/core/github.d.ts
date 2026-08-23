/**
 * GitHub 认证与限流感知(P2/A1,采纳外部评审意见)
 *
 * Token 解析优先级:配置指定环境变量名 → GITHUB_TOKEN → GH_TOKEN → 匿名。
 * Token 是"增强凭据"而非"必需凭据":无 Token 时匿名降级,功能可用仅配额受限。
 * 绝不持久化、日志或经工具输出回显 Token。
 */
import { DeepAtlasConfig } from '../config.js';
export declare function resolveGithubToken(config?: Pick<DeepAtlasConfig, 'githubTokenEnv'>): string | undefined;
export declare function authMode(token?: string): 'authenticated' | 'anonymous';
export declare const RATE_FLOOR = 50;
/** 从响应读取限流事实(GitHub 标准头) */
export declare function rateInfoFromHeaders(h: Headers): {
    remaining?: number;
    reset?: number;
};
