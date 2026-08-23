const API = 'https://api.github.com';
const TOPIC_QUERY = 'topic:dsh-plugin';
const PER_PAGE = 100;
const SEARCH_RESULT_LIMIT = 1000;
const MAX_RETRY = 4;
const GITHUB_EPOCH_SECONDS = Date.parse('2008-01-01T00:00:00Z') / 1000;
const isoSecond = (seconds) => new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
const sleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted)
        return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    }, { once: true });
});
async function fetchPage(url, headers, signal) {
    let retry = 0;
    for (;;) {
        signal?.throwIfAborted();
        const res = await fetch(url, { headers, signal });
        if (res.ok) {
            const json = (await res.json());
            if (json.incomplete_results) {
                if (retry >= MAX_RETRY)
                    throw new Error(`GitHub Search returned incomplete_results after ${retry} retries`);
                await sleep(2 ** retry * 1_000, signal);
                retry++;
                continue;
            }
            return { items: json.items, total: json.total_count };
        }
        if ((res.status === 403 || res.status === 429) && retry < MAX_RETRY) {
            const retryAfter = Number(res.headers.get('retry-after') ?? '0') * 1000;
            const resetAt = Number(res.headers.get('x-ratelimit-reset') ?? '0') * 1000;
            const resetWait = resetAt > Date.now() ? resetAt - Date.now() + 1_000 : 0;
            const wait = retryAfter || resetWait || 2 ** retry * 1_000;
            await sleep(Math.min(wait, 65_000), signal);
            retry++;
            continue;
        }
        throw new Error(`GitHub API ${res.status} (retried ${retry} times)`);
    }
}
function toEntry(repo) {
    const observedAt = new Date().toISOString();
    return {
        id: repo.full_name.toLowerCase(),
        name: repo.name,
        repoUrl: repo.html_url,
        description: repo.description ?? '',
        stars: repo.stargazers_count,
        lastPushedAt: repo.pushed_at,
        license: repo.license?.spdx_id ?? 'none',
        topics: repo.topics ?? [],
        provenance: {
            sourceId: 'github-topic', sourceKind: 'github-search', authority: 'publisher',
            repository: repo.full_name.toLowerCase(), ref: { kind: 'snapshot', value: repo.pushed_at },
            query: TOPIC_QUERY, observedAt, upstreamUpdatedAt: repo.pushed_at,
            originGroup: `publisher:${repo.full_name.toLowerCase()}`,
        },
    };
}
export class GitHubTopicSource {
    options;
    id = 'github-topic';
    label = 'GitHub topic: dsh-plugin';
    reportedTotal = 0;
    truncated = false;
    constructor(options = {}) {
        this.options = options;
    }
    async *collect(_token, outerSignal) {
        const { token, since, onProgress } = this.options;
        const signal = outerSignal ?? this.options.signal;
        const headers = { Accept: 'application/vnd.github+json' };
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const end = Math.floor((this.options.now ?? new Date()).getTime() / 1000);
        const parsedSince = since ? Math.floor(Date.parse(since) / 1000) : undefined;
        if (since && !Number.isFinite(parsedSince))
            throw new Error(`Invalid incremental timestamp: ${since}`);
        // Partition on immutable repository creation time. Incremental selection is
        // an additional pushed filter; repositories cannot move between partitions
        // while a long scan is running.
        const start = GITHUB_EPOCH_SECONDS;
        const seen = new Set();
        let fetched = 0;
        let pageCount = 0;
        let root = true;
        const source = this;
        const queryUrl = (from, to, page) => {
            const pushed = parsedSince === undefined ? '' : ` pushed:>${isoSecond(parsedSince)}`;
            const q = `${TOPIC_QUERY} created:${isoSecond(from)}..${isoSecond(to)}${pushed}`;
            return `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`;
        };
        async function* collectRange(from, to) {
            signal?.throwIfAborted();
            const first = await fetchPage(queryUrl(from, to, 1), headers, signal);
            if (root) {
                source.reportedTotal = first.total;
                root = false;
            }
            if (first.total > SEARCH_RESULT_LIMIT) {
                if (from >= to) {
                    source.truncated = true;
                    throw new Error(`GitHub Search partition still exceeds 1,000 results at ${isoSecond(from)}`);
                }
                const midpoint = Math.floor((from + to) / 2);
                yield* collectRange(from, midpoint);
                yield* collectRange(midpoint + 1, to);
                return;
            }
            const pages = Math.ceil(first.total / PER_PAGE);
            for (let page = 1; page <= pages; page++) {
                const current = page === 1 ? first : await fetchPage(queryUrl(from, to, page), headers, signal);
                for (const repo of current.items) {
                    const id = repo.full_name.toLowerCase();
                    if (seen.has(id))
                        continue;
                    seen.add(id);
                    fetched++;
                    yield toEntry(repo);
                }
                pageCount++;
                onProgress?.({
                    page: pageCount,
                    fetched,
                    total: source.reportedTotal,
                    partition: `${isoSecond(from)}..${isoSecond(to)}`,
                });
            }
        }
        yield* collectRange(start, end);
        this.truncated = false;
    }
}
//# sourceMappingURL=github-topic.js.map