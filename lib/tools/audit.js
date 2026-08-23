import { WHITELIST_REPOS } from '../core/sources/awesome-list.js';
import { looseObjectOutput, renderJson } from './common.js';
import { buildPluginRecord, toRequirement } from '../core/record.js';
import { checkCompatibility, getRuntimeInfo } from '../core/compat.js';
import { buildAuditReportV1 } from '../core/audit-v1.js';
import { AuditCache } from '../core/audit-cache.js';
import { defaultDataDir } from '../core/index-store.js';
const RAW = 'https://raw.githubusercontent.com';
async function fetchManifest(target, commit) {
    const ref = commit ?? 'HEAD';
    const url = `${RAW}/${target}/${ref}/package.json`;
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        return (await res.json());
    }
    catch {
        return null;
    }
}
async function fetchRaw(target, file, commit) {
    const ref = commit ?? 'HEAD';
    try {
        const res = await fetch(`${RAW}/${target}/${ref}/${file}`);
        if (!res.ok)
            return null;
        return await res.text();
    }
    catch {
        return null;
    }
}
export function buildAuditTool(_ctx, config) {
    return {
        name: 'deepatlas_audit',
        description: '对目标插件执行装前安全审计(生命周期脚本/依赖形态/协议/commit 锁定/白名单),返回绿黄红分级与逐条证据。安装前必须执行。',
        parameters: {
            target: { type: 'string', required: true, description: '目标仓库,格式 owner/repo' },
            commit: { type: 'string', description: '锁定的 commit 短哈希;不传则视为未锁定' },
        },
        output: { schema: looseObjectOutput, render: renderJson },
        async execute(args) {
            const target = args.target.toLowerCase().replace(/^github:/, '');
            // ⑤ 内容寻址缓存:同 repo+commit+版本 直接复用
            const cache = new AuditCache(defaultDataDir(config.dataDir));
            if (args.commit) {
                const cached = await cache.get(target, args.commit);
                if (cached)
                    return { ...cached, action: '(来自审计缓存,同 commit 复用)' };
            }
            const manifest = await fetchManifest(target, args.commit);
            // v1 源码信号:抓 main 入口与 patch 文件(失败静默,清单层仍可用)
            const files = {};
            const main = typeof manifest?.main === 'string' ? manifest.main : 'lib/index.js';
            for (const f of [main, 'cordis.patch.yml']) {
                const text = await fetchRaw(target, f, args.commit);
                if (text !== null)
                    files[f] = text;
            }
            const report = buildAuditReportV1({ target, manifest, commitPinned: Boolean(args.commit), whitelisted: WHITELIST_REPOS.includes(target) }, files);
            // 兼容性闸门:PluginRecord + 当前运行时对照
            const record = buildPluginRecord(target, manifest);
            const compatibility = checkCompatibility(toRequirement(record), getRuntimeInfo());
            const payload = {
                ...report,
                auditedRef: args.commit ?? 'HEAD',
                pluginRecord: record,
                compatibility,
            };
            if (args.commit)
                await cache.put(target, args.commit, payload);
            if (report.risk.level === 'red') {
                return { ...payload, action: '红色风险:拒绝自动安装,请人工审查源码后手动处理' };
            }
            if (!args.commit) {
                return { ...payload, action: '注意:本次审计基于 HEAD(漂移对象)。安装前必须锁定 commit 并重新审计,审计对象与安装对象必须一致(TOCTOU 防护)' };
            }
            return {
                ...payload,
                action: report.risk.level === 'elevated'
                    ? 'Elevated(源码信号):可继续,但请阅读信号清单——是风险提示而非安全判定'
                    : report.level === 'yellow'
                        ? '黄色风险:可在用户二次确认后继续安装流程'
                        : '绿色:可进入用户确认与安装流程',
            };
        },
    };
}
//# sourceMappingURL=audit.js.map