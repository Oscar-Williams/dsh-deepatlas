import { rank } from './ranker.js';
import { GitHubTopicSource } from './sources/github-topic.js';
import { AwesomeListSource, WHITELIST_REPOS } from './sources/awesome-list.js';
import { hydratePublisherEvidence } from './publisher-evidence.js';
import { classifyKind } from './kind.js';
import { EVIDENCE_EXTRACTOR_VERSION, EVIDENCE_RULE_VERSION, TAXONOMY_VERSION, evidenceFromObservations } from './capabilities.js';
import { SCHEMA_VERSION } from './index-store.js';
/** 按仓库自述关键词的粗粒度类型推断(精判兜底,证据弱于 contents API) */
function inferType(entry) {
    const text = `${entry.name} ${entry.description}`.toLowerCase();
    if (/\bskill\b|技能/.test(text))
        return 'skill';
    if (/\bbundle\b|全家桶|发行版/.test(text))
        return 'bundle';
    if (/cordis|插件|plugin/.test(text))
        return 'cordis';
    return 'unknown';
}
function toMeta(entry, sourceId) {
    const provenance = entry.provenance ?? {
        sourceId, sourceKind: 'legacy-index', authority: 'legacy', repository: entry.id,
        observedAt: new Date().toISOString(), originGroup: `legacy:${sourceId}:${entry.id}`,
    };
    const observation = {
        values: { name: entry.name, description: entry.description, topics: entry.topics, provides: entry.provides ?? [] },
        provenance,
    };
    return {
        id: entry.id,
        name: entry.name,
        repoUrl: entry.repoUrl,
        description: entry.description,
        type: inferType(entry),
        kind: classifyKind({ id: entry.id, name: entry.name, description: entry.description }),
        displayName: entry.name,
        typeSource: 'heuristic',
        stars: entry.stars,
        lastPushedAt: entry.lastPushedAt,
        license: entry.license,
        topics: entry.topics,
        whitelisted: WHITELIST_REPOS.includes(entry.id),
        provides: entry.provides ?? [],
        observations: [observation],
        source: sourceId,
        fetchedAt: new Date().toISOString(),
    };
}
/** 合并策略:新条目字段优先,空值回落旧值;白名单命中保留 */
function mergeMeta(existing, incoming) {
    const observations = [...(existing.observations ?? []), ...(incoming.observations ?? [])];
    const uniqueObservations = [...new Map(observations.map((observation) => {
            const key = JSON.stringify([observation.provenance.sourceId, observation.provenance.repository,
                observation.provenance.ref, observation.provenance.path, observation.values]);
            return [key, observation];
        })).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return {
        ...existing,
        name: incoming.name || existing.name,
        description: incoming.description || existing.description,
        type: incoming.type !== 'unknown' ? incoming.type : existing.type,
        typeSource: incoming.typeSource === 'contents' ? 'contents' : existing.typeSource,
        stars: incoming.stars || existing.stars,
        lastPushedAt: incoming.lastPushedAt || existing.lastPushedAt,
        license: incoming.license !== 'unknown' && incoming.license !== 'none' ? incoming.license : existing.license,
        topics: incoming.topics.length ? incoming.topics : existing.topics,
        whitelisted: existing.whitelisted || incoming.whitelisted,
        provides: incoming.provides.length ? incoming.provides : existing.provides,
        source: incoming.source || existing.source,
        fetchedAt: incoming.fetchedAt,
        observations: uniqueObservations,
    };
}
export class Scanner {
    store;
    sources;
    constructor(store, sources = [new GitHubTopicSource(), new AwesomeListSource()]) {
        this.store = store;
        this.sources = sources;
    }
    async scan(options = {}) {
        options.signal?.throwIfAborted();
        const previous = await this.store.load();
        const incremental = Boolean(options.incremental && previous);
        const since = incremental ? previous.builtAt : undefined;
        const sources = incremental
            ? this.sources.map((s) => (s instanceof GitHubTopicSource ? new GitHubTopicSource({
                token: options.token,
                since,
                signal: options.signal,
                onProgress: (progress) => options.onProgress?.({
                    sourceId: 'github-topic',
                    message: `已读取 ${progress.fetched}/${progress.total}（分片页 ${progress.page}）`,
                }),
            }) : s))
            : this.sources.map((s) => (s instanceof GitHubTopicSource ? new GitHubTopicSource({
                token: options.token,
                signal: options.signal,
                onProgress: (progress) => options.onProgress?.({
                    sourceId: 'github-topic',
                    message: `已读取 ${progress.fetched}/${progress.total}（分片页 ${progress.page}）`,
                }),
            }) : s));
        const healths = [];
        // 以仓库 id 为键去重;GitHub topic 数据优先(star/时间更准),awesome 补白名单
        const merged = new Map();
        if (incremental && previous) {
            for (const p of previous.plugins)
                merged.set(p.id, p);
        }
        // 增量模式有旧索引兜底,0 新条目也可落盘;全量模式必须抓到 ≥1 条
        let anyOk = incremental;
        for (const source of sources) {
            const health = {
                sourceId: source.id,
                ok: true,
                itemCount: 0,
                fetchedAt: new Date().toISOString(),
                mode: incremental ? 'incremental' : 'full',
            };
            const sourceEntries = [];
            try {
                for await (const entry of source.collect(options.token, options.signal)) {
                    options.signal?.throwIfAborted();
                    health.itemCount++;
                    sourceEntries.push(entry);
                }
                if (source instanceof GitHubTopicSource) {
                    health.reportedTotal = source.reportedTotal;
                    health.truncated = source.truncated;
                }
                for (const entry of sourceEntries) {
                    const incoming = toMeta(entry, source.id);
                    const existing = merged.get(entry.id);
                    merged.set(entry.id, existing ? mergeMeta(existing, incoming) : incoming);
                }
                if (sourceEntries.length > 0)
                    anyOk = true;
            }
            catch (err) {
                if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError'))
                    throw err;
                health.ok = false;
                health.error = err instanceof Error ? err.message : String(err);
                options.onProgress?.({ sourceId: source.id, message: `源 ${source.id} 失败:${health.error}(降级继续)` });
            }
            healths.push(health);
        }
        if (!anyOk)
            throw new Error('全部数据源失败且无旧索引可用,保留原索引不落盘');
        // 主发现源失败时,全量模式只能在旧索引上保守合并,不得用较小降级源覆盖旧数据。
        const sourceFailed = healths.some((health) => !health.ok);
        if (!incremental && previous && sourceFailed) {
            for (const plugin of previous.plugins) {
                if (!merged.has(plugin.id))
                    merged.set(plugin.id, plugin);
            }
        }
        // 发布者证据:一次解析 commit 后，在同一 SHA 下读取 manifest/README/入口。
        // 仅富化候选头部；生态发现与 publisher coverage 分开报告。
        const enrichN = options.enrichTopN ?? (incremental ? 0 : 30);
        if (enrichN > 0) {
            const targets = [...merged.values()]
                .sort((a, b) => b.stars - a.stars)
                .slice(0, enrichN)
                .map((m) => m.id);
            options.onProgress?.({ sourceId: 'publisher-evidence', message: `固定提交证据采集 ${targets.length} 个仓库…` });
            for (let index = 0; index < targets.length; index++) {
                options.signal?.throwIfAborted();
                const id = targets[index];
                const result = await hydratePublisherEvidence(id, { token: options.token, signal: options.signal });
                const meta = merged.get(id);
                if (!meta)
                    continue;
                const observations = [...(meta.observations ?? []), ...result.observations];
                merged.set(id, {
                    ...meta,
                    type: result.type === 'unknown' ? meta.type : result.type,
                    typeSource: result.type === 'unknown' ? meta.typeSource : 'contents',
                    observations: [...new Map(observations.map((item) => [JSON.stringify([item.provenance.originGroup, item.provenance.ref, item.provenance.path, item.values]), item])).values()],
                    publisherCoverage: result.coverage,
                });
                if ((index + 1) % 10 === 0 || index + 1 === targets.length) {
                    options.onProgress?.({ sourceId: 'publisher-evidence', message: `固定提交证据采集 ${index + 1}/${targets.length}` });
                }
            }
        }
        // Evidence v2:保留各来源观察值，再生成可追踪 atoms 与 capability claims。
        const plugins = [...merged.values()].map((meta) => ({
            ...meta,
            capsEv: undefined,
            evidence: evidenceFromObservations(meta.observations ?? [], meta.observations?.some((observation) => observation.provenance.authority !== 'legacy') ? 'complete' : 'legacy-partial'),
            quality: rank(meta),
        }));
        plugins.sort((a, b) => (b.quality?.total ?? 0) - (a.quality?.total ?? 0));
        const index = {
            schemaVersion: SCHEMA_VERSION,
            evidenceMeta: {
                taxonomyVersion: TAXONOMY_VERSION,
                extractorVersion: EVIDENCE_EXTRACTOR_VERSION,
                ruleVersion: EVIDENCE_RULE_VERSION,
                state: plugins.every((plugin) => plugin.evidence.state === 'complete') ? 'complete' : 'legacy-partial',
            },
            builtAt: new Date().toISOString(),
            sources: healths,
            plugins,
        };
        options.signal?.throwIfAborted();
        await this.store.save(index);
        return index;
    }
    /** 读取当前索引(不存在返回 null) */
    async loadIndex() {
        return this.store.load();
    }
    /** 索引体检:条目数、构建时间、数据源状态、TTL、Top10 预览 */
    async status(ttlHours) {
        const index = await this.store.load();
        if (!index)
            return { exists: false, location: this.store.location };
        const top10 = index.plugins.filter((p) => !p.deadLink).slice(0, 10).map((p) => ({
            name: p.name,
            id: p.id,
            stars: p.stars,
            quality: p.quality?.total ?? 0,
            type: p.type,
        }));
        return {
            exists: true,
            location: this.store.location,
            pluginCount: index.plugins.length,
            builtAt: index.builtAt,
            stale: this.store.isStale(index, ttlHours),
            sources: index.sources,
            top10,
        };
    }
}
//# sourceMappingURL=scanner.js.map