/** 最近提交距今天数 → 活跃度分(0-100):7 天内满分,180 天以上归零 */
export function activityScore(lastPushedAt, now = new Date()) {
    const t = Date.parse(lastPushedAt);
    if (Number.isNaN(t))
        return 0;
    const days = (now.getTime() - t) / 86_400_000;
    if (days <= 7)
        return 100;
    if (days >= 180)
        return 0;
    return Math.round(100 * (1 - (days - 7) / 173));
}
/**
 * star 对数缩放 → 社区分(0-100)。
 * 参考基数 15 万(头部生态位):0 星 0 分;千星级 ~58;万星级 ~78;
 * 官方 harness 183k⭐ ~100。修复旧版(基数 1000)头部全部饱和同分的缺陷。
 */
export function communityScore(stars) {
    if (stars <= 0)
        return 0;
    const ref = Math.log10(150_001);
    return Math.min(100, Math.round((Math.log10(stars + 1) / ref) * 100));
}
/** 可信度分(0-100):白名单 +50,宽松开源协议 +30,规范命名(dsh- 前缀)+20,归档 -20 */
export function trustScore(meta) {
    let s = 0;
    if (meta.whitelisted)
        s += 50;
    const permissive = ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause', 'BSD-2-Clause', 'CC0-1.0', '0BSD'];
    if (permissive.includes(meta.license))
        s += 30;
    if (/^(dsh|deepseek)[-_]/i.test(meta.name))
        s += 20;
    if (meta.archived)
        s -= 20;
    return Math.min(100, Math.max(0, s));
}
/** 综合静态分(match 恒为 0,推荐阶段由模型语义匹配后补足) */
export function rank(meta) {
    const activity = activityScore(meta.lastPushedAt);
    const community = communityScore(meta.stars);
    const trust = trustScore(meta);
    const total = Math.round(activity * 0.35 + community * 0.25 + trust * 0.25);
    return { total, activity, community, trust, match: 0 };
}
//# sourceMappingURL=ranker.js.map