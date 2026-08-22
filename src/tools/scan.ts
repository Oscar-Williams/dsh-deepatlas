/**
 * 工具:deepatlas_scan / deepatlas_status(M1)
 * 扫描 dsh-plugin 生态并重建本地索引;status 查看索引健康度。
 */
import { Context } from '@deepseek-ai/cordis'
import { Schema } from '@deepseek-ai/schemastery'
import { DeepAtlasConfig } from '../config'
import { Scanner } from '../core/scanner'
import { IndexStore, defaultDataDir } from '../core/index-store'

export function scannerFor(config: DeepAtlasConfig) {
  const store = new IndexStore(defaultDataDir(config.dataDir))
  return new Scanner(store)
}

export function buildScanTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_scan',
    description:
      '扫描 DSH 插件生态(GitHub topic dsh-plugin 与 awesome 清单)并重建本地索引。耗时约数十秒,24 小时内已有索引时建议先用 deepatlas_status 检查。',
    parameters: Schema.object({
      confirm: Schema.boolean().required().description('索引重建会产生网络请求,需用户确认为 true'),
    }),
    async execute(args: { confirm: boolean }) {
      if (!args.confirm) return { ok: false, message: '用户未确认,取消扫描' }
      const scanner = scannerFor(config)
      const token = process.env[config.githubTokenEnv] || undefined
      const index = await scanner.scan({ token })
      return {
        ok: true,
        pluginCount: index.plugins.length,
        builtAt: index.builtAt,
        location: new IndexStore(defaultDataDir(config.dataDir)).location,
        sources: index.sources,
      }
    },
  }
}

export function buildStatusTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_status',
    description: '查看 DeepAtlas 本地索引健康度:条目数、构建时间、是否过期、各数据源抓取状态。',
    parameters: Schema.object({}),
    async execute() {
      const scanner = scannerFor(config)
      return await scanner.status(config.indexTtlHours)
    },
  }
}
