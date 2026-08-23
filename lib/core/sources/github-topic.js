const API = 'https://api.github.com';
const TOPIC_QUERY = 'topic:dsh-plugin';
const PER_PAGE = 100;
const MAX_PAGES = 100; // 10000 条上限(API 硬限),超出需按时间窗分段(P2 优化)
const MAX_RETRY = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchPage(url, headers) {
    let retry = 0;
    // 速率限制退避:403/429 时按 Retry-After 或 2^n 秒等待,有限重试后放弃
    for (;;) {
        const res = await fetch(url, { headers });
        if (res.ok) {
            const json = (await res.json());
            return { items: json.items, total: json.total_count };
        }
        if ((res.status === 403 || res.status === 429) && retry < MAX_RETRY) {
            const wait = Number(res.headers.get('retry-after') ?? '0') * 1000 || 2 ** retry * 1000;
            await sleep(Math.min(wait, 30_000));
            retry++;
            continue;
        }
        throw new Error(`GitHub API ${res.status}(重试 ${retry} 次后放弃)`);
    }
}
export class GitHubTopicSource {
    options;
    id = 'github-topic';
    label = 'GitHub topic: dsh-plugin';
    constructor(options = {}) {
        this.options = options;
    }
    async *collect() {
        const { token, since, onProgress } = this.options;
        const headers = { Accept: 'application/vnd.github+json' };
        if (token)
            headers.Authorization = `Bearer ${token}`;
        // 增量用 pushed: 过滤器;全量只按 topic
        const q = since ? `${TOPIC_QUERY} pushed:>${since}` : TOPIC_QUERY;
        let fetched = 0;
        for (let page = 1; page <= MAX_PAGES; page++) {
            const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`;
            const { items, total } = await fetchPage(url, headers);
            if (items.length === 0)
                break;
            for (const repo of items) {
                fetched++;
                yield {
                    id: repo.full_name.toLowerCase(),
                    name: repo.name,
                    repoUrl: repo.html_url,
                    description: repo.description ?? '',
                    stars: repo.stargazers_count,
                    lastPushedAt: repo.pushed_at,
                    license: repo.license?.spdx_id ?? 'none',
                    topics: repo.topics ?? [],
                };
            }
            onProgress?.({ page, fetched, total });
            if (fetched >= total)
                break; // 最后一页收尾
        }
    }
}
//# sourceMappingURL=github-topic.js.map