import { defineTool } from '@deepseek-ai/dsh-tools';
import { Config } from './config.js';
import { buildScanTool, buildStatusTool } from './tools/scan.js';
import { buildFindTool } from './tools/find.js';
import { buildAuditTool } from './tools/audit.js';
import { buildInstallTool } from './tools/install.js';
export const name = 'dsh-deepatlas';
// 声明依赖 Cordis 的 tools 服务:本插件通过注册工具暴露全部能力
export const inject = ['tools'];
export { Config };
export function apply(ctx, config) {
    ctx.logger.info('DeepAtlas(dsh-插件导航)挂载完成,dryRun=%s', config.dryRun);
    // 五个工具对齐任务书 M1–M5:
    // scan/status(扫描/索引/体检) find(任务推荐) audit(安全审计) install(授权安装)
    ctx.tools.register(defineTool(buildScanTool(ctx, config)));
    ctx.tools.register(defineTool(buildStatusTool(ctx, config)));
    ctx.tools.register(defineTool(buildFindTool(ctx, config)));
    ctx.tools.register(defineTool(buildAuditTool(ctx, config)));
    ctx.tools.register(defineTool(buildInstallTool(ctx, config)));
    ctx.on('dispose', () => {
        ctx.logger.info('DeepAtlas 卸载');
    });
}
//# sourceMappingURL=index.js.map