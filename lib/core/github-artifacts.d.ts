export declare const MAX_ARTIFACT_BYTES = 1048576;
export interface RepositoryArtifact {
    repository: string;
    commit: string;
    path: string;
    text: string;
    contentSha256: string;
    size: number;
}
export interface FetchArtifactResult {
    artifact: RepositoryArtifact | null;
    error?: string;
}
export type ArtifactFetch = typeof fetch;
export interface RepositoryRootEntry {
    name: string;
    path: string;
    type: 'file' | 'dir';
}
export declare function normalizeRepositoryPath(value: string): string | null;
export declare function resolveCommit(repository: string, ref?: string, token?: string, signal?: AbortSignal, fetcher?: ArtifactFetch): Promise<string>;
export declare function fetchArtifactAtCommit(repository: string, file: string, commit: string, token?: string, signal?: AbortSignal, fetcher?: ArtifactFetch, maxBytes?: number): Promise<FetchArtifactResult>;
export declare function listRepositoryRootAtCommit(repository: string, commit: string, token?: string, signal?: AbortSignal, fetcher?: ArtifactFetch): Promise<RepositoryRootEntry[]>;
export declare function declaredSourceFiles(manifest: Record<string, unknown>): {
    files: string[];
    error?: string;
};
