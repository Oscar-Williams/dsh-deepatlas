import type { AtlasIndex } from '../types.js';
export interface EvidenceReport {
    schemaVersion: number;
    evidenceState: 'complete' | 'legacy-partial';
    plugins: number;
    eligiblePlugins: number;
    pluginsWithEvidence: number;
    completePlugins: number;
    atoms: number;
    acceptedClaims: number;
    provisionalClaims: number;
    conflictedClaims: number;
    rejectedClaims: number;
    malformedRecords: number;
    unresolvedReferences: number;
    duplicateEvidenceIds: number;
    unresolvedSupersedes: number;
    invalidSupersedes: number;
    supersedeCycles: number;
    staleClaims: number;
    stateMismatches: number;
    invalidCapabilityIds: string[];
    legacyPlugins: number;
    failedSources: number;
    truncatedSources: number;
    incompleteSources: number;
    sourceKinds: Record<string, number>;
    capabilityCounts: Record<string, number>;
    structuralGate: 'PASS' | 'FAIL';
    releaseGate: 'PASS' | 'FAIL';
    /** 兼容旧报告消费者，等同 structuralGate。 */
    gate: 'PASS' | 'FAIL';
}
/** Evidence v2 schema/provenance Gate；覆盖率单独报告，不用生态噪声倒推阈值。 */
export declare function buildEvidenceReport(index: AtlasIndex): EvidenceReport;
