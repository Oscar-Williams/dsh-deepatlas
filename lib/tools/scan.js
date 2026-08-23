import { Scanner } from '../core/scanner.js';
import { IndexStore, defaultDataDir } from '../core/index-store.js';
import { asLosslessJson, looseObjectOutput, renderJson } from './common.js';
import { resolveGithubToken, authMode } from '../core/github.js';
export function scannerFor(config) {
    const store = new IndexStore(defaultDataDir(config.dataDir));
    return new Scanner(store);
}
export function buildScanTool(_ctx, config) {
    return {
        name: 'deepatlas_scan',
        description: '扫描 DSH 插件生态(GitHub topic dsh-plugin 与 awesome 清单)并重建本地索引。支持全量(默认)与增量(已有索引时仅抓更新,更快)。首次使用建议全量。',
        parameters: {
            confirm: { type: 'boolean', required: true, description: '索引重建会产生网络请求,需用户确认为 true' },
            incremental: { type: 'boolean', description: '增量模式:基于上次索引时间只抓有更新的仓库;无索引时自动全量' },
        },
        output: { schema: looseObjectOutput, render: renderJson },
        async execute(args, execution) {
            if (!args.confirm)
                return { ok: false, message: '用户未确认,取消扫描' };
            const scanner = scannerFor(config);
            const token = resolveGithubToken(config);
            const index = await scanner.scan({ token, incremental: args.incremental, signal: execution?.signal });
            return asLosslessJson({
                ok: true,
                pluginCount: index.plugins.length,
                builtAt: index.builtAt,
                location: new IndexStore(defaultDataDir(config.dataDir)).location,
                sources: index.sources,
            });
        },
    };
}
export function buildStatusTool(_ctx, config) {
    return {
        name: 'deepatlas_status',
        description: '查看 DeepAtlas 本地索引健康度:条目数、构建时间、是否过期、各数据源抓取状态与 Top10 质量分预览。',
        parameters: {},
        output: { schema: looseObjectOutput, render: renderJson },
        async execute() {
            const scanner = scannerFor(config);
            const status = await scanner.status(config.indexTtlHours);
            // 认证模式与元数据覆盖率(不回显 Token 本体)
            const enriched = (await scanner.loadIndex())?.plugins.filter((p) => p.metadataFetchedAt).length ?? 0;
            return asLosslessJson({
                ...status,
                githubAuth: authMode(resolveGithubToken(config)),
                metadataCoverage: status.exists ? { enriched, total: status.pluginCount } : undefined,
            });
        },
    };
}
//# sourceMappingURL=scan.js.map