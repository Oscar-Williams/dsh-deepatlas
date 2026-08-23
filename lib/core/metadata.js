import { rank } from './ranker.js';
import { RATE_FLOOR, rateInfoFromHeaders } from './github.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 真实实现:GET /repos/{owner}/{repo}(404 视为死链,403/429 视为限流) */
export const githubRepoFetcher = async (id, token) => {
    const headers = { Accept: 'application/vnd.github+json' };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${id}`, { headers });
    const { remaining } = rateInfoFromHeaders(res.headers);
    if (res.status === 404)
        return { ok: false, missing: true, remaining };
    if (res.status === 403 || res.status === 429) {
        const ra = Number(res.headers.get('retry-after') ?? '0');
        return { ok: false, retryAfterMs: ra > 0 ? ra * 1000 : 60_000, remaining };
    }
    if (!res.ok)
        return { ok: false, remaining };
    const j = (await res.json());
    return {
        ok: true,
        remaining,
        data: {
            stars: Number(j.stargazers_count ?? 0),
            pushedAt: String(j.pushed_at ?? ''),
            license: j.license?.spdx_id ?? 'none',
            archived: Boolean(j.archived),
            fork: Boolean(j.fork),
            defaultBranch: String(j.default_branch ?? ''),
        },
    };
};
const WEEK_MS = 7 * 24 * 3600_000;
/** 回填判定:缺 star/时间,或元数据已超 7 天未刷新 */
export function needsBackfill(meta, now = Date.now()) {
    if (!meta.metadataFetchedAt)
        return true;
    if ((meta.stars ?? 0) <= 0 && !meta.lastPushedAt)
        return true;
    return now - Date.parse(meta.metadataFetchedAt) > WEEK_MS;
}
export async function backfillMetadata(store, options = {}) {
    const index = await store.load();
    if (!index)
        throw new Error('索引不存在,请先 scan');
    const fetcher = options.fetcher ?? githubRepoFetcher;
    const limit = options.limit ?? Number.POSITIVE_INFINITY;
    const targets = index.plugins.filter((p) => needsBackfill(p));
    const total = Math.min(targets.length, Number.isFinite(limit) ? limit : targets.length);
    let updated = 0;
    let dead = 0;
    let stoppedReason;
    for (let i = 0; i < total; i++) {
        const meta = targets[i];
        const r = await fetcher(meta.id, options.token);
        if (!r.ok) {
            if (r.missing) {
                // 死链(404/改名/删除):标记后不再重试,推荐侧过滤
                const idx = index.plugins.findIndex((p) => p.id === meta.id);
                if (idx >= 0) {
                    index.plugins[idx] = { ...index.plugins[idx], deadLink: true, metadataFetchedAt: new Date().toISOString() };
                    if ((updated + dead) % 50 === 0)
                        await store.save(index);
                    dead++;
                }
                options.onProgress?.(i + 1, total);
                await sleep(350);
                continue;
            }
            if (r.remaining !== undefined && r.remaining < RATE_FLOOR) {
                stoppedReason = 'rate-floor';
                break;
            }
            if (r.retryAfterMs && r.retryAfterMs > 60_000) {
                stoppedReason = 'retry-after';
                break;
            }
            continue; // 单条失败不阻断
        }
        if (r.remaining !== undefined && r.remaining < RATE_FLOOR) {
            stoppedReason = 'rate-floor';
        }
        const idx = index.plugins.findIndex((p) => p.id === meta.id);
        if (idx >= 0) {
            const merged = {
                ...index.plugins[idx],
                stars: r.data.stars || index.plugins[idx].stars,
                lastPushedAt: r.data.pushedAt || index.plugins[idx].lastPushedAt,
                license: r.data.license !== 'none' ? r.data.license : index.plugins[idx].license,
                archived: r.data.archived,
                fork: r.data.fork,
                defaultBranch: r.data.defaultBranch,
                metadataFetchedAt: new Date().toISOString(),
            };
            index.plugins[idx] = { ...merged, quality: rank(merged) };
            updated++;
            // 分批持久化:每 50 条落盘一次,中断可续跑(已更新条目 7 天内不重抓)
            if (updated % 50 === 0)
                await store.save(index);
        }
        options.onProgress?.(i + 1, total);
        if (stoppedReason)
            break;
        await sleep(350);
    }
    index.plugins.sort((a, b) => (b.quality?.total ?? 0) - (a.quality?.total ?? 0));
    await store.save(index);
    return { updated, dead, skipped: targets.length - updated - dead, stoppedReason };
}
//# sourceMappingURL=metadata.js.map