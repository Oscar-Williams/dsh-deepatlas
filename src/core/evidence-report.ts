import { CAPABILITY_IDS, EVIDENCE_EXTRACTOR_VERSION, EVIDENCE_RULE_VERSION, TAXONOMY_VERSION } from './capabilities.js'
import { eligible } from './retrieval.js'
import type { AtlasIndex, EvidenceAtom } from '../types.js'

export interface EvidenceReport {
  schemaVersion: number
  evidenceState: 'complete' | 'legacy-partial'
  plugins: number
  eligiblePlugins: number
  pluginsWithEvidence: number
  atoms: number
  acceptedClaims: number
  provisionalClaims: number
  conflictedClaims: number
  rejectedClaims: number
  malformedRecords: number
  unresolvedReferences: number
  duplicateEvidenceIds: number
  invalidCapabilityIds: string[]
  legacyPlugins: number
  sourceKinds: Record<string, number>
  capabilityCounts: Record<string, number>
  gate: 'PASS' | 'FAIL'
}

function validAtom(atom: EvidenceAtom): boolean {
  return Boolean(
    atom.evidenceId && atom.subject && atom.provenance.sourceId && atom.provenance.sourceKind
    && atom.provenance.authority && atom.provenance.repository && atom.provenance.observedAt
    && atom.provenance.originGroup && atom.extractor.id && atom.extractor.version && atom.extractor.taxonomyVersion,
  )
}

/** Evidence v2 schema/provenance Gate；覆盖率单独报告，不用生态噪声倒推阈值。 */
export function buildEvidenceReport(index: AtlasIndex): EvidenceReport {
  const validIds = new Set(CAPABILITY_IDS)
  const invalidCapabilityIds = new Set<string>()
  const sourceKinds: Record<string, number> = {}
  const capabilityCounts: Record<string, number> = Object.fromEntries(CAPABILITY_IDS.map((id) => [id, 0]))
  let atoms = 0, acceptedClaims = 0, provisionalClaims = 0, conflictedClaims = 0, rejectedClaims = 0
  let malformedRecords = 0, unresolvedReferences = 0, duplicateEvidenceIds = 0, legacyPlugins = 0, pluginsWithEvidence = 0

  for (const plugin of index.plugins) {
    const evidence = plugin.evidence
    if (!evidence) { malformedRecords++; continue }
    pluginsWithEvidence++
    if (evidence.state === 'legacy-partial') legacyPlugins++
    const ids = new Set<string>()
    for (const atom of evidence.atoms) {
      atoms++
      if (!validAtom(atom)) malformedRecords++
      if (ids.has(atom.evidenceId)) duplicateEvidenceIds++
      ids.add(atom.evidenceId)
      sourceKinds[atom.provenance.sourceKind] = (sourceKinds[atom.provenance.sourceKind] ?? 0) + 1
    }
    for (const claim of evidence.capabilities) {
      if (!validIds.has(claim.id)) invalidCapabilityIds.add(claim.id)
      else capabilityCounts[claim.id]++
      if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) malformedRecords++
      if (claim.decision === 'accepted') acceptedClaims++
      else if (claim.decision === 'provisional') provisionalClaims++
      else if (claim.decision === 'conflicted') conflictedClaims++
      else rejectedClaims++
      for (const id of [...claim.supportEvidenceIds, ...claim.contradictionEvidenceIds]) if (!ids.has(id)) unresolvedReferences++
    }
  }
  const invalid = [...invalidCapabilityIds].sort()
  const metaValid = index.evidenceMeta?.taxonomyVersion === TAXONOMY_VERSION
    && index.evidenceMeta.extractorVersion === EVIDENCE_EXTRACTOR_VERSION
    && index.evidenceMeta.ruleVersion === EVIDENCE_RULE_VERSION
  return {
    schemaVersion: index.schemaVersion,
    evidenceState: index.evidenceMeta?.state ?? 'legacy-partial',
    plugins: index.plugins.length,
    eligiblePlugins: index.plugins.filter(eligible).length,
    pluginsWithEvidence, atoms, acceptedClaims, provisionalClaims, conflictedClaims, rejectedClaims,
    malformedRecords, unresolvedReferences, duplicateEvidenceIds, invalidCapabilityIds: invalid,
    legacyPlugins, sourceKinds, capabilityCounts,
    gate: metaValid && malformedRecords === 0 && unresolvedReferences === 0 && duplicateEvidenceIds === 0 && invalid.length === 0 ? 'PASS' : 'FAIL',
  }
}
