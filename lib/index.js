import { defineTool } from '@deepseek-ai/dsh-tools';
import { Config } from './config.js';
import { buildScanTool, buildStatusTool } from './tools/scan.js';
import { buildFindTool } from './tools/find.js';
import { buildAuditTool } from './tools/audit.js';
import { buildInstallTool } from './tools/install.js';
import { buildAdviseTool } from './tools/advise.js';
export const name = 'dsh-deepatlas';
// 声明依赖 Cordis 的 tools 服务:本插件通过注册工具暴露全部能力
export const inject = ['tools'];
export { Config };
export function apply(ctx, config) {
    ctx.logger.info('DeepAtlas(dsh-插件导航)挂载完成,dryRun=%s', config.dryRun);
    // 六个工具:scan/status find audit install + advise(P4.1 能力缺口顾问)
    ctx.tools.register(defineTool(buildScanTool(ctx, config)));
    ctx.tools.register(defineTool(buildStatusTool(ctx, config)));
    ctx.tools.register(defineTool(buildFindTool(ctx, config)));
    ctx.tools.register(defineTool(buildAuditTool(ctx, config)));
    ctx.tools.register(defineTool(buildInstallTool(ctx, config)));
    ctx.tools.register(defineTool(buildAdviseTool(ctx, config)));
    ctx.on('dispose', () => {
        ctx.logger.info('DeepAtlas 卸载');
    });
}
//# sourceMappingURL=index.js.map