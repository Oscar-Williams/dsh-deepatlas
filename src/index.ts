/**
 * DeepAtlas for DeepSeek Harness(dsh-插件导航)
 *
 * 任务感知的 DSH 插件生态导航:自动扫描 dsh-plugin 生态并建立本地索引,
 * 根据用户当前任务推荐插件,装前安全审计,获得用户明确授权后才安装。
 *
 * 遵循 DSH 正式外部插件规范(dev.to 教程 / docs/cookbook/adding-a-package.md):
 * 命名导出 name / inject / Config / apply。
 */
import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { Config, DeepAtlasConfig } from './config.js'
import { buildScanTool, buildStatusTool } from './tools/scan.js'
import { buildFindTool } from './tools/find.js'
import { buildAuditTool } from './tools/audit.js'
import { buildInstallTool } from './tools/install.js'

export const name = 'dsh-deepatlas'

// 声明依赖 Cordis 的 tools 服务:本插件通过注册工具暴露全部能力
export const inject = ['tools']

export { Config }
export type { DeepAtlasConfig }

export function apply(ctx: Context, config: DeepAtlasConfig) {
  ctx.logger.info('DeepAtlas(dsh-插件导航)挂载完成,dryRun=%s', config.dryRun)

  // 五个工具对齐任务书 M1–M5:
  // scan/status(扫描/索引/体检) find(任务推荐) audit(安全审计) install(授权安装)
  ctx.tools.register(defineTool(buildScanTool(ctx, config)))
  ctx.tools.register(defineTool(buildStatusTool(ctx, config)))
  ctx.tools.register(defineTool(buildFindTool(ctx, config)))
  ctx.tools.register(defineTool(buildAuditTool(ctx, config)))
  ctx.tools.register(defineTool(buildInstallTool(ctx, config)))

  ctx.on('dispose', () => {
    ctx.logger.info('DeepAtlas 卸载')
  })
}
