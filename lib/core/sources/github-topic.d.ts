/**
 * GitHub topic `dsh-plugin` discovery source.
 *
 * GitHub Search exposes at most 1,000 results per query. Complete collection
 * recursively partitions the repository creation/push time range until every
 * query fits below that ceiling, then paginates every partition.
 */
import { EcosystemSource, RawPluginEntry } from './types.js';
export interface TopicProgress {
    page: number;
    fetched: number;
    total: number;
    partition?: string;
}
export interface TopicCollectOptions {
    token?: string;
    /** Incremental mode: repositories pushed after this ISO 8601 timestamp. */
    since?: string;
    onProgress?: (p: TopicProgress) => void;
    signal?: AbortSignal;
    /** Test seam; production uses the current time. */
    now?: Date;
}
export declare class GitHubTopicSource implements EcosystemSource {
    private readonly options;
    readonly id = "github-topic";
    readonly label = "GitHub topic: dsh-plugin";
    reportedTotal: number;
    truncated: boolean;
    constructor(options?: TopicCollectOptions);
    collect(_token?: string, outerSignal?: AbortSignal): AsyncGenerator<RawPluginEntry, void, unknown>;
}
