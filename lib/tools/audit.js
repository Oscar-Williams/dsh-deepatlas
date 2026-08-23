import { audit } from '../core/auditor.js';
import { WHITELIST_REPOS } from '../core/sources/awesome-list.js';
import { looseObjectOutput, renderJson } from './common.js';
import { buildPluginRecord, toRequirement } from '../core/record.js';
import { checkCompatibility, getRuntimeInfo } from '../core/compat.js';
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
export function buildAuditTool(_ctx, _config) {
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
            const manifest = await fetchManifest(target, args.commit);
            const report = audit({
                target,
                manifest,
                commitPinned: Boolean(args.commit),
                whitelisted: WHITELIST_REPOS.includes(target),
            });
            // 兼容性闸门(P2):PluginRecord + 当前运行时对照
            const record = buildPluginRecord(target, manifest);
            const compatibility = checkCompatibility(toRequirement(record), getRuntimeInfo());
            const payload = { ...report, pluginRecord: record, compatibility };
            if (report.level === 'red') {
                return { ...payload, action: '红色风险:拒绝自动安装,请人工审查源码后手动处理' };
            }
            return {
                ...payload,
                action: report.level === 'yellow'
                    ? '黄色风险:可在用户二次确认后继续安装流程'
                    : '绿色:可进入用户确认与安装流程',
            };
        },
    };
}
//# sourceMappingURL=audit.js.map