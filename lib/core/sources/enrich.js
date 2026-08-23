/**
 * 类型精判(P1 · 任务 1.3):读仓库根文件清单判定插件类型
 *
 * 规则(优于关键词推断):
 * - 根含 SKILL.md / skills/ 目录 → skill
 * - package.json 含 "dsh" 字段 → cordis(bundle 判定需读值,P2 细分)
 * - 其余 → unknown(保留启发式结果)
 *
 * 为控制 API 用量,仅对索引头部(star 靠前)的仓库做精判;
 * 其余沿用启发式,以 typeSource 字段区分证据来源。
 */
const API = 'https://api.github.com';
const sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted)
        return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
});
export async function enrichType(repoId, token, signal) {
    signal?.throwIfAborted();
    const headers = { Accept: 'application/vnd.github+json' };
    if (token)
        headers.Authorization = `Bearer ${token}`;
    let contents;
    try {
        const res = await fetch(`${API}/repos/${repoId}/contents`, { headers, signal });
        if (!res.ok)
            return null;
        contents = (await res.json());
    }
    catch (error) {
        if (signal?.aborted)
            throw error;
        return null;
    }
    const names = new Set(contents.map((c) => c.name.toLowerCase()));
    if (names.has('skill.md') || names.has('skills')) {
        return { type: 'skill', evidence: '根目录存在 SKILL.md 或 skills/' };
    }
    if (names.has('package.json')) {
        try {
            const pkg = (await (await fetch(`https://raw.githubusercontent.com/${repoId}/HEAD/package.json`, { signal })).json());
            if (pkg && typeof pkg === 'object' && 'dsh' in pkg) {
                return { type: 'cordis', evidence: 'package.json 声明 dsh 字段' };
            }
        }
        catch (error) {
            if (signal?.aborted)
                throw error;
            /* package.json 读取失败按 unknown 处理 */
        }
    }
    return { type: 'unknown', evidence: '文件清单未命中判定规则' };
}
/** 带速率节流的批量精判:每批之间留间隔,失败静默保留启发式结果 */
export async function enrichTopN(repoIds, token, onProgress, signal) {
    const out = new Map();
    for (let i = 0; i < repoIds.length; i++) {
        signal?.throwIfAborted();
        const r = await enrichType(repoIds[i], token, signal);
        if (r)
            out.set(repoIds[i], r);
        onProgress?.(i + 1);
        await sleep(350, signal); // contents API 未认证限额 60/h,认证 5000/h;保守节流
    }
    return out;
}
//# sourceMappingURL=enrich.js.map