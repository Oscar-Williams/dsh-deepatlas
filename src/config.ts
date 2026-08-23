/**
 * DeepAtlas 插件配置(schemastery 定义)
 *
 * 遵循 DSH 插件规范:命名导出 Config,由 Cordis 注入用户配置。
 * 安全默认值:dryRun=true，安装需显式同意。
 */
import Schema from '@deepseek-ai/schemastery'

export interface DeepAtlasConfig {
  /** 索引与日志目录；默认位于当前 DSH_HOME/deepatlas */
  dataDir: string
  /** 安装时使用的 dsh profile 名 */
  installProfile: string
  /** 索引过期时长(小时),超过则提示刷新 */
  indexTtlHours: number
  /** 低于该 star 数的仓库默认不进入推荐(仍可被显式搜索) */
  minStars: number
  /** GitHub Token 环境变量名(提高 API 限额,可选) */
  githubTokenEnv: string
  /** 默认 dry-run,不调用 dsh 安装 */
  dryRun: boolean
}

export const Config = Schema.object({
  dataDir: Schema.string().default('').description('索引与日志目录,留空则使用当前 DSH_HOME/deepatlas'),
  installProfile: Schema.string().default('web').description('安装时使用的 dsh profile 名'),
  indexTtlHours: Schema.number().default(24).description('索引过期时长(小时)'),
  minStars: Schema.number().default(0).description('进入推荐的最低 star 数'),
  githubTokenEnv: Schema.string().default('DEEPATLAS_GITHUB_TOKEN').description('GitHub Token 的环境变量名'),
  dryRun: Schema.boolean().default(true).description('试运行模式:只生成安装命令,不真正安装'),
})
