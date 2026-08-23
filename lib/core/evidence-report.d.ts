import type { AtlasIndex } from '../types.js';
export interface EvidenceReport {
    schemaVersion: number;
    evidenceState: 'complete' | 'legacy-partial';
    plugins: number;
    eligiblePlugins: number;
    pluginsWithEvidence: number;
    atoms: number;
    acceptedClaims: number;
    provisionalClaims: number;
    conflictedClaims: number;
    rejectedClaims: number;
    malformedRecords: number;
    unresolvedReferences: number;
    duplicateEvidenceIds: number;
    invalidCapabilityIds: string[];
    legacyPlugins: number;
    sourceKinds: Record<string, number>;
    capabilityCounts: Record<string, number>;
    gate: 'PASS' | 'FAIL';
}
/** Evidence v2 schema/provenance Gate；覆盖率单独报告，不用生态噪声倒推阈值。 */
export declare function buildEvidenceReport(index: AtlasIndex): EvidenceReport;
