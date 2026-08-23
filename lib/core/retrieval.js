import { classifyKind, isInstallable } from './kind.js';
import { extractCapabilities, resolveCapabilityClaims } from './capabilities.js';
export function tokenize(need) {
    const raw = need.toLowerCase();
    return [...new Set(raw.split(/[^\p{Script=Han}\p{L}\p{N}]+/u)
            .flatMap((w) => (/\p{Script=Han}/u.test(w) ? (w.match(/.{1,2}/gu) ?? []) : [w]))
            .filter((t) => t.length >= 2))];
}
export function eligible(p) {
    const kind = p.kind ?? classifyKind({ id: p.id, name: p.displayName ?? p.name, description: p.description, fork: p.fork });
    return !p.deadLink && !p.archived && isInstallable(kind);
}
/** 多字段检索:v3 混合归一——静态抽取 ∪ 模型传入的规范能力 ID(v3-A) */
export function retrieve(task, plugins, poolSize = 30, extraTaskCaps = []) {
    const tokens = tokenize(task);
    const taskCaps = new Set([...extractCapabilities(task), ...extraTaskCaps]);
    const scored = [];
    for (const p of plugins) {
        if (!eligible(p))
            continue;
        const name = (p.displayName ?? p.name).toLowerCase();
        const desc = p.description.toLowerCase();
        const topics = p.topics.join(' ').toLowerCase();
        // v3-B:索引期固化的能力证据优先;旧索引回退到查询期抽取
        const claims = resolveCapabilityClaims(p);
        const usableClaims = claims.filter((claim) => claim.decision === 'accepted' || claim.decision === 'provisional');
        const byCapability = new Map(usableClaims.map((claim) => [claim.id, claim]));
        const capOverlap = [...taskCaps].filter((capability) => byCapability.has(capability));
        const capabilityEvidence = capOverlap.map((id) => {
            const claim = byCapability.get(id);
            return { id, confidence: claim.confidence, decision: claim.decision, evidenceIds: claim.supportEvidenceIds };
        });
        // 字段加权 lexical:name 命中 ×4,description ×3,topics ×2
        let lexScore = 0;
        let nameBonus = 0;
        for (const t of tokens) {
            if (name.includes(t)) {
                lexScore += 4;
                nameBonus += 4;
            }
            if (desc.includes(t))
                lexScore += 3;
            if (topics.includes(t))
                lexScore += 2;
        }
        const capabilityScore = capabilityEvidence.reduce((sum, claim) => sum + 5 * claim.confidence, 0);
        const taskScore = capabilityScore + lexScore;
        if (taskScore <= 0)
            continue;
        scored.push({ plugin: p, taskScore, capOverlap, lexScore, nameBonus, capabilityEvidence });
    }
    return scored
        .sort((a, b) => {
        const fa = a.taskScore * 10 + (a.plugin.quality?.total ?? 0) * 3;
        const fb = b.taskScore * 10 + (b.plugin.quality?.total ?? 0) * 3;
        return fb - fa;
    })
        .slice(0, poolSize);
}
//# sourceMappingURL=retrieval.js.map