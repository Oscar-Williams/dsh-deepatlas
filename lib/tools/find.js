import { scannerFor } from './scan.js';
import { looseObjectOutput, renderJson } from './common.js';
import { getRuntimeInfo } from '../core/compat.js';
/** 关键词预筛:分词后在 name/description/topics 中计数 */
function prescore(meta, tokens) {
    const haystack = `${meta.name} ${meta.description} ${meta.topics.join(' ')}`.toLowerCase();
    return tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
}
/** 重叠对比(结构化):同类型且共享关键词的更高分插件 */
function overlapFor(target, all, tokens) {
    const sibling = all.find((p) => p.id !== target.id &&
        p.type === target.type &&
        prescore(p, tokens) > 0 &&
        (p.quality?.total ?? 0) > (target.quality?.total ?? 0));
    if (!sibling)
        return undefined;
    const starRatio = target.stars > 0 ? Math.round((sibling.stars / target.stars) * 10) / 10 : Infinity;
    return {
        id: sibling.id,
        name: sibling.name,
        stars: sibling.stars,
        quality: sibling.quality?.total ?? 0,
        note: `功能可能重叠:${sibling.name}(⭐${sibling.stars},质量分 ${sibling.quality?.total})高于本条${starRatio !== Infinity ? `约 ${starRatio} 倍 star` : ''},请对比后选择`,
    };
}
export function buildFindTool(_ctx, config) {
    return {
        name: 'deepatlas_find',
        description: '按自然语言任务需求在本地索引中检索插件,返回候选列表(含质量分、匹配提示、安装命令预览)。若索引缺失或过期会提示先扫描。语义相关性由模型基于返回的候选元数据判断。',
        parameters: {
            need: { type: 'string', required: true, description: '任务需求,如"接入微信并监控 token 花费"' },
            limit: { type: 'number', description: '返回候选上限,默认 8' },
        },
        output: { schema: looseObjectOutput, render: renderJson },
        async execute(args) {
            const scanner = scannerFor(config);
            const status = await scanner.status(config.indexTtlHours);
            if (!status.exists) {
                return { ok: false, message: '本地索引不存在,请先调用 deepatlas_scan 重建索引' };
            }
            if (status.stale) {
                return { ok: false, message: '索引已过期,请先调用 deepatlas_scan 刷新' };
            }
            const index = await scanner.loadIndex();
            const plugins = (index?.plugins ?? []).filter((p) => p.stars >= config.minStars && !p.deadLink);
            // 中英混合分词:英文按词,中文按 2-gram(轻量方案,不引外部分词依赖)
            const raw = args.need.toLowerCase();
            const tokens = [
                ...new Set(raw
                    .split(/[^\p{Script=Han}\p{L}\p{N}]+/u)
                    .flatMap((w) => (/\p{Script=Han}/u.test(w) ? (w.match(/.{1,2}/gu) ?? []) : [w]))
                    .filter((t) => t.length >= 2)),
            ];
            const candidates = plugins
                .map((p) => ({ p, s: prescore(p, tokens) }))
                .filter(({ s }) => s > 0)
                .sort((a, b) => b.s - a.s || (b.p.quality?.total ?? 0) - (a.p.quality?.total ?? 0))
                .slice(0, args.limit ?? 8)
                .map(({ p }) => {
                const [owner, repo] = p.id.split('/');
                const archivedNote = p.archived ? ';⚠️仓库已归档' : '';
                const rec = {
                    plugin: p,
                    reason: `命中关键词:${tokens.filter((t) => `${p.name} ${p.description}`.toLowerCase().includes(t)).join(', ') || '(语义匹配)'};质量分 ${p.quality?.total}(活跃 ${p.quality?.activity}/社区 ${p.quality?.community}/可信 ${p.quality?.trust})${archivedNote}`,
                    overlap: overlapFor(p, plugins, tokens),
                    overlapNote: overlapFor(p, plugins, tokens)?.note,
                    installCommandPreview: `dsh plugin --profile ${config.installProfile} add github:${owner}/${repo}#<commit>`,
                };
                return rec;
            });
            const runtime = getRuntimeInfo();
            return {
                ok: true,
                need: args.need,
                runtime: {
                    platform: `${runtime.platform}/${runtime.arch}`,
                    node: runtime.nodeVersion,
                    note: '逐插件兼容性结论(Node 引擎/native/构建脚本)需经 deepatlas_audit 获取;安装前必须审计',
                },
                candidates,
                hint: candidates.length === 0 ? '索引中无关键词命中,可由模型再判断是否语义相关,或建议用户去 GitHub topic 搜索' : undefined,
            };
        },
    };
}
//# sourceMappingURL=find.js.map