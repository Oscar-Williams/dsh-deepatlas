import type { PluginObservation, PublisherCoverage, PluginType } from '../types.js';
import { type ArtifactFetch, type RepositoryArtifact } from './github-artifacts.js';
export interface PublisherEvidenceResult {
    commit?: string;
    observations: PluginObservation[];
    coverage: PublisherCoverage;
    type: PluginType;
    artifacts: Array<Pick<RepositoryArtifact, 'path' | 'contentSha256' | 'size'>>;
}
export declare function hydratePublisherEvidence(repository: string, options?: {
    ref?: string;
    token?: string;
    signal?: AbortSignal;
    fetcher?: ArtifactFetch;
    observedAt?: string;
}): Promise<PublisherEvidenceResult>;
