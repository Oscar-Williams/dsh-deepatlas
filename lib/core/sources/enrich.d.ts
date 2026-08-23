export interface EnrichResult {
    type: 'skill' | 'cordis' | 'bundle' | 'unknown';
    /** 命中证据,如 "根目录存在 SKILL.md" */
    evidence: string;
}
export declare function enrichType(repoId: string, token?: string, signal?: {
    aborted: boolean;
}): Promise<EnrichResult | null>;
/** 带速率节流的批量精判:每批之间留间隔,失败静默保留启发式结果 */
export declare function enrichTopN(repoIds: string[], token?: string, onProgress?: (done: number) => void): Promise<Map<string, EnrichResult>>;
