export interface DeepAtlasConfig {
    /** 索引与日志目录；默认位于当前 DSH_HOME/deepatlas */
    dataDir: string;
    /** 安装时使用的 dsh profile 名 */
    installProfile: string;
    /** 索引过期时长(小时),超过则提示刷新 */
    indexTtlHours: number;
    /** 低于该 star 数的仓库默认不进入推荐(仍可被显式搜索) */
    minStars: number;
    /** GitHub Token 环境变量名(提高 API 限额,可选) */
    githubTokenEnv: string;
    /** 默认 dry-run,不调用 dsh 安装 */
    dryRun: boolean;
}
export declare const Config: any;
