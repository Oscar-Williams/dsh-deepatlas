import { createHash } from 'node:crypto';
export const TAXONOMY_VERSION = 'capability-taxonomy-v1';
export const EVIDENCE_EXTRACTOR_VERSION = 'capability-evidence-v2.0.0';
export const EVIDENCE_RULE_VERSION = 'capability-claims-v2.0.0';
export const CAPABILITIES = [
    { id: 'messaging-wechat', aliases: ['wechat', 'weixin', '微信', '企业微信', 'wecom'] },
    { id: 'messaging-telegram', aliases: ['telegram', 'tg', '电报'] },
    { id: 'messaging-im', aliases: ['im', '即时通讯', '消息推送', '机器人通知', 'notify', 'notification', '通知推送', '飞书', 'feishu', 'lark', '钉钉', 'dingtalk', 'qq'] },
    { id: 'deep-reading', aliases: ['deepread', 'deep read', '深度阅读', '网页阅读', 'read later', '摘要'] },
    { id: 'long-term-memory', aliases: ['memory', 'memorize', '记忆', '长期记忆', '跨会话', 'cross-session', '记住', '偏好'] },
    { id: 'knowledge-base', aliases: ['knowledge', '知识库', '向量', 'vector', 'rag', 'embedding', '检索增强'] },
    { id: 'browser-automation', aliases: ['browser', '浏览器', 'chrome', 'web automation', '网页自动化', '填表', 'playwright', 'puppeteer'] },
    { id: 'web-search', aliases: ['search', '搜索', '联网', 'web search', '检索网页'] },
    { id: 'token-monitor', aliases: ['token', '用量', '余额', '花费', '成本', 'cost', 'usage', '计费', 'billing', '监控'] },
    { id: 'context-compression', aliases: ['压缩', 'compress', 'context', '上下文', '省 token', 'token 优化', 'compaction'] },
    { id: 'ui-theme', aliases: ['theme', 'skin', '皮肤', '美化', '主题', 'appearance'] },
    { id: 'desktop-gui', aliases: ['desktop', '桌面', 'gui', '图形界面', 'standalone app', '客户端'] },
    { id: 'tui-terminal', aliases: ['tui', 'terminal', '终端', '命令行', 'cli ui', '会话分叉', '分叉'] },
    { id: 'sidebar-workbench', aliases: ['sidebar', '侧边栏', '工作台', 'workbench', '面板', 'panel', 'ide'] },
    { id: 'git-integration', aliases: ['git', '提交历史', 'github', 'commit', 'diff', '版本'] },
    { id: 'task-board', aliases: ['看板', 'taskboard', 'task board', 'kanban', '任务板', 'todo'] },
    { id: 'database', aliases: ['database', '数据库', 'sqlite', 'sql', '表结构', 'postgres', 'mysql', 'databases', 'db'] },
    { id: 'spreadsheet-doc', aliases: ['表格', 'spreadsheet', 'excel', 'office', '文档处理', 'word', 'univer'] },
    { id: 'image-vision', aliases: ['image', '图片', '视觉', 'vision', '识图', '图像', 'imageunderstanding', 'multimodal'] },
    { id: 'ocr', aliases: ['ocr', '文字识别', '截图识别'] },
    { id: 'screenshot', aliases: ['screenshot', '截图', '截屏', 'capture'] },
    { id: 'ssh-remote', aliases: ['ssh', '远程服务器', 'remote', '远程执行'] },
    { id: 'mobile-remote', aliases: ['手机', 'mobile', '移动端', '远程访问'] },
    { id: 'automation-schedule', aliases: ['定时', 'schedule', 'cron', '自动化', 'automation', '定时任务', 'trigger'] },
    { id: 'backup', aliases: ['backup', '备份', '同步', 'sync'] },
    { id: 'workflow-orchestration', aliases: ['workflow', '工作流', '编排', 'orchestration', '多 agent', '调度', 'pipeline'] },
    { id: 'coding-tools', aliases: ['coding', '编程', 'lsp', '代码补全', 'refactor'] },
    { id: 'prompt-enhance', aliases: ['prompt', '提示词', '去 ai 味', '润色'] },
];
/** 模型可传入的规范能力 ID。工具 schema 与运行时校验共用这一事实源。 */
export const CAPABILITY_IDS = CAPABILITIES.map((capability) => capability.id);
const CAPABILITY_ID_SET = new Set(CAPABILITY_IDS);
/** deepatlas_find 与 deepatlas_advise 共用的模型输入契约。 */
export const CAPABILITY_PARAMETER_SCHEMA = {
    type: 'array',
    items: { type: 'string', enum: CAPABILITY_IDS },
    description: '模型理解任务后传入的规范能力 ID 数组,可显著提升口语化任务的召回。',
};
/**
 * 规范化模型传入的能力 ID。数组是公开工具契约；字符串仅用于兼容旧的直接调用。
 * 未知 ID 会被忽略，避免绕过 schema 的调用污染检索条件。
 */
export function normalizeCapabilityIds(input) {
    const values = Array.isArray(input) ? input : (input ?? '').split(',');
    return [...new Set(values.map((value) => value.trim()).filter((value) => CAPABILITY_ID_SET.has(value)))];
}
/** 从任意文本抽取能力:中文 alias 子串匹配;拉丁 alias 词边界匹配(防 word→keywords 误伤) */
export function extractCapabilities(text) {
    const t = text.toLowerCase();
    const out = new Set();
    for (const cap of CAPABILITIES) {
        for (const alias of cap.aliases) {
            const a = alias.toLowerCase();
            if (/[a-z0-9]/.test(a) && !/\p{Script=Han}/u.test(a)) {
                // 纯拉丁别名:词边界(短词如 word/data/search 不许在 keywords 里误命中)
                if (new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'u').test(t)) {
                    out.add(cap.id);
                    break;
                }
            }
            else if (t.includes(a)) {
                out.add(cap.id);
                break;
            }
        }
    }
    return out;
}
function aliasPattern(alias) {
    const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /[a-z0-9]/.test(alias) && !/\p{Script=Han}/u.test(alias)
        ? new RegExp(`(^|[^a-z0-9])(${escaped})([^a-z0-9]|$)`, 'giu')
        : new RegExp(`(${escaped})`, 'giu');
}
function defaultProvenance(source) {
    return {
        sourceId: 'direct-extraction',
        sourceKind: source === 'legacy' ? 'legacy-index' : 'manifest',
        authority: source === 'legacy' ? 'legacy' : 'publisher',
        repository: 'unknown',
        observedAt: '1970-01-01T00:00:00.000Z',
        originGroup: source === 'legacy' ? 'legacy:unknown' : 'publisher:unknown',
    };
}
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const entries = Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([a], [b]) => a.localeCompare(b));
        return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
function stableHash(value) {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
function signalKind(part) {
    if (part.source === 'manifest-capability')
        return 'manifest-declaration';
    if (part.source === 'topics' || part.source === 'provides' || part.source === 'package-keyword')
        return 'exact-topic';
    if (part.source === 'legacy')
        return 'legacy';
    return part.provenance?.authority === 'community' ? 'curation' : 'publisher-text';
}
function atomFor(capabilityId, part, alias) {
    const match = alias ? aliasPattern(alias).exec(part.text.toLowerCase()) : null;
    if (alias && !match)
        return null;
    const hit = match ? (match[2] ?? match[1] ?? alias) : capabilityId;
    const hitAt = match ? match.index + match[0].indexOf(hit) : 0;
    const start = Math.max(0, hitAt - 24);
    const end = Math.min(part.text.length, hitAt + hit.length + 24);
    const excerpt = part.text.slice(start, end).replace(/\s+/g, ' ').trim();
    const baseProvenance = part.provenance ?? defaultProvenance(part.source);
    const provenance = { ...baseProvenance, jsonPointer: baseProvenance.jsonPointer ?? `/${part.source}` };
    const signal = { kind: signalKind(part), matchedAlias: alias, rawValue: part.text, excerpt };
    const contentSha256 = provenance.contentSha256 ?? stableHash(part.text);
    const identityProvenance = {
        sourceId: provenance.sourceId,
        sourceKind: provenance.sourceKind,
        authority: provenance.authority,
        repository: provenance.repository,
        ref: provenance.ref,
        path: provenance.path,
        jsonPointer: provenance.jsonPointer,
        query: provenance.query,
        upstreamUpdatedAt: provenance.upstreamUpdatedAt,
        contentSha256,
        originGroup: provenance.originGroup,
    };
    const supersedesEvidenceIds = [...new Set(part.supersedesEvidenceIds ?? [])].sort();
    const polarity = part.polarity ?? 'supports';
    const identity = { capabilityId, polarity, signal, provenance: identityProvenance, supersedesEvidenceIds, extractor: EVIDENCE_EXTRACTOR_VERSION };
    return {
        evidenceId: stableHash(identity),
        subject: `capability:${capabilityId}`,
        polarity,
        signal,
        provenance: { ...provenance, contentSha256 },
        ...(supersedesEvidenceIds.length ? { supersedesEvidenceIds } : {}),
        extractor: { id: 'deepatlas-capability-extractor', version: EVIDENCE_EXTRACTOR_VERSION, taxonomyVersion: TAXONOMY_VERSION },
    };
}
/**
 * Evidence v2：事实 atom 与派生 claim 分离。同一 authority 内只采用最强信号，
 * 只有独立 authority 的佐证才增加最多 0.10，避免同一发布者堆叠关键词抬分。
 */
export function extractCapabilityEvidence(parts, state = 'complete') {
    const atoms = [];
    for (const part of parts) {
        if (part.capabilityId) {
            if (!CAPABILITY_ID_SET.has(part.capabilityId))
                continue;
            const hit = atomFor(part.capabilityId, part);
            if (hit)
                atoms.push(hit);
            continue;
        }
        for (const cap of CAPABILITIES) {
            const hit = cap.aliases.map((alias) => atomFor(cap.id, part, alias)).find(Boolean);
            if (hit)
                atoms.push(hit);
        }
    }
    const uniqueAtoms = [...new Map(atoms
            .sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b)))
            .map((atom) => [atom.evidenceId, atom])).values()]
        .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
    return { schemaVersion: 2, state, atoms: uniqueAtoms, capabilities: computeCapabilityClaims(uniqueAtoms, state) };
}
function atomWeight(atom, state) {
    if (state === 'legacy-partial' || atom.signal.kind === 'legacy')
        return 0.35;
    if (atom.signal.kind === 'manifest-declaration')
        return 0.95;
    if (atom.signal.kind === 'implementation')
        return 0.9;
    if (atom.signal.kind === 'exact-topic')
        return 0.8;
    if (atom.signal.kind === 'publisher-text')
        return atom.signal.matchedAlias && atom.provenance.jsonPointer === '/name' ? 0.4 : 0.7;
    if (atom.signal.kind === 'curation')
        return 0.4;
    return 0.35;
}
export function computeCapabilityClaims(atoms, state) {
    const superseded = new Set(atoms.flatMap((atom) => atom.supersedesEvidenceIds ?? []));
    const activeAtoms = atoms.filter((atom) => !superseded.has(atom.evidenceId));
    const grouped = new Map();
    for (const atom of activeAtoms) {
        if (!atom.subject.startsWith('capability:'))
            continue;
        const id = atom.subject.slice('capability:'.length);
        const list = grouped.get(id) ?? [];
        list.push(atom);
        grouped.set(id, list);
    }
    return [...grouped.entries()].map(([id, evidence]) => {
        const support = evidence.filter((atom) => atom.polarity === 'supports');
        const contradiction = evidence.filter((atom) => atom.polarity === 'contradicts');
        const strongestByAuthority = new Map();
        for (const atom of support) {
            const weight = atomWeight(atom, state);
            strongestByAuthority.set(atom.provenance.authority, Math.max(strongestByAuthority.get(atom.provenance.authority) ?? 0, weight));
        }
        const sorted = [...strongestByAuthority.values()].sort((a, b) => b - a);
        const strongest = sorted[0] ?? 0;
        const score = Number(Math.min(0.98, strongest + Math.min(0.1, Math.max(0, sorted.length - 1) * 0.05)).toFixed(3));
        const strongestContradiction = Math.max(0, ...contradiction.map((atom) => atomWeight(atom, state)));
        const decision = support.length && contradiction.length && strongestContradiction >= strongest
            ? 'conflicted'
            : score >= 0.75 ? 'accepted' : score >= 0.5 ? 'provisional' : 'rejected';
        return {
            id,
            decision,
            confidence: score,
            supportEvidenceIds: support.map((atom) => atom.evidenceId).sort(),
            contradictionEvidenceIds: contradiction.map((atom) => atom.evidenceId).sort(),
            computedBy: { ruleVersion: EVIDENCE_RULE_VERSION, taxonomyVersion: TAXONOMY_VERSION, extractorVersion: EVIDENCE_EXTRACTOR_VERSION },
        };
    }).sort((a, b) => a.id.localeCompare(b.id));
}
export function evidenceFromObservations(observations, state = 'complete') {
    const parts = [];
    for (const observation of observations) {
        const p = observation.provenance;
        parts.push({ source: 'name', text: observation.values.name, provenance: { ...p, jsonPointer: '/name' } }, { source: 'description', text: observation.values.description, provenance: { ...p, jsonPointer: '/description' } }, { source: 'topics', text: observation.values.topics.join(' '), provenance: { ...p, jsonPointer: '/topics' } }, { source: 'provides', text: observation.values.provides.join(' '), provenance: { ...p, jsonPointer: '/provides' } });
    }
    return extractCapabilityEvidence(parts, state);
}
/** 业务层统一解析；v2 空 claims 保持为空，不回退文本猜测。 */
export function resolveCapabilityClaims(plugin) {
    if (plugin.evidence?.schemaVersion === 2)
        return plugin.evidence.capabilities;
    const legacyParts = [
        { source: 'legacy', text: plugin.name },
        { source: 'legacy', text: plugin.description },
        { source: 'legacy', text: plugin.topics.join(' ') },
    ];
    return extractCapabilityEvidence(legacyParts, 'legacy-partial').capabilities;
}
/** 兼容旧测试/调用点；返回完整 Evidence v2 的 capability claims。 */
export function extractCapabilityRecords(parts) {
    return extractCapabilityEvidence(parts).capabilities;
}
//# sourceMappingURL=capabilities.js.map