import { CAPABILITY_IDS, EVIDENCE_EXTRACTOR_VERSION, EVIDENCE_RULE_VERSION, TAXONOMY_VERSION } from './capabilities.js'
import { eligible } from './retrieval.js'
import { computeCapabilityClaims } from './capabilities.js'
import { SCHEMA_VERSION } from './index-store.js'
import type { AtlasIndex, CapabilityClaim, EvidenceAtom } from '../types.js'

export interface EvidenceReport {
  schemaVersion: number
  evidenceState: 'complete' | 'legacy-partial'
  plugins: number
  eligiblePlugins: number
  pluginsWithEvidence: number
  completePlugins: number
  atoms: number
  acceptedClaims: number
  provisionalClaims: number
  conflictedClaims: number
  rejectedClaims: number
  malformedRecords: number
  unresolvedReferences: number
  duplicateEvidenceIds: number
  unresolvedSupersedes: number
  invalidSupersedes: number
  supersedeCycles: number
  staleClaims: number
  stateMismatches: number
  invalidCapabilityIds: string[]
  legacyPlugins: number
  failedSources: number
  truncatedSources: number
  incompleteSources: number
  publisherCompletePlugins: number
  invalidPublisherAtoms: number
  acceptedClaimsWithoutPinnedPublisher: number
  sourceKinds: Record<string, number>
  capabilityCounts: Record<string, number>
  structuralGate: 'PASS' | 'FAIL'
  releaseGate: 'PASS' | 'FAIL'
  /** 兼容旧报告消费者，等同 structuralGate。 */
  gate: 'PASS' | 'FAIL'
}

function validAtom(atom: EvidenceAtom): boolean {
  return Boolean(
    atom.evidenceId && atom.subject && atom.provenance.sourceId && atom.provenance.sourceKind
    && atom.provenance.authority && atom.provenance.repository && atom.provenance.observedAt
    && atom.provenance.originGroup && atom.extractor.id && atom.extractor.version && atom.extractor.taxonomyVersion,
  )
}

function canonicalClaims(claims: CapabilityClaim[]): string {
  return JSON.stringify([...claims].sort((a, b) => a.id.localeCompare(b.id)))
}

function countSupersedeCycles(atoms: EvidenceAtom[]): number {
  const graph = new Map(atoms.map((atom) => [atom.evidenceId, atom.supersedesEvidenceIds ?? []]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cyclic = new Set<string>()
  const path: string[] = []
  const visit = (id: string): void => {
    if (visited.has(id)) return
    if (visiting.has(id)) {
      const start = path.lastIndexOf(id)
      for (const member of path.slice(start)) cyclic.add(member)
      return
    }
    visiting.add(id)
    path.push(id)
    for (const target of graph.get(id) ?? []) if (graph.has(target)) visit(target)
    path.pop()
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of graph.keys()) visit(id)
  return cyclic.size
}

/** Evidence v2 schema/provenance Gate；覆盖率单独报告，不用生态噪声倒推阈值。 */
export function buildEvidenceReport(index: AtlasIndex): EvidenceReport {
  const validIds = new Set(CAPABILITY_IDS)
  const invalidCapabilityIds = new Set<string>()
  const sourceKinds: Record<string, number> = {}
  const capabilityCounts: Record<string, number> = Object.fromEntries(CAPABILITY_IDS.map((id) => [id, 0]))
  let atoms = 0, acceptedClaims = 0, provisionalClaims = 0, conflictedClaims = 0, rejectedClaims = 0
  let malformedRecords = 0, unresolvedReferences = 0, duplicateEvidenceIds = 0, unresolvedSupersedes = 0
  let invalidSupersedes = 0, supersedeCycles = 0
  let legacyPlugins = 0, pluginsWithEvidence = 0, completePlugins = 0, staleClaims = 0, stateMismatches = 0
  let publisherCompletePlugins = 0, invalidPublisherAtoms = 0, acceptedClaimsWithoutPinnedPublisher = 0

  for (const plugin of index.plugins) {
    const evidence = plugin.evidence
    if (plugin.publisherCoverage?.status === 'complete') publisherCompletePlugins++
    if (!evidence) { malformedRecords++; continue }
    pluginsWithEvidence++
    if (evidence.state === 'legacy-partial') legacyPlugins++
    else completePlugins++
    const ids = new Set<string>()
    for (const atom of evidence.atoms) {
      atoms++
      if (!validAtom(atom)) malformedRecords++
      if (atom.provenance.authority === 'publisher') {
        const pinned = atom.provenance.ref?.kind === 'commit' && /^[0-9a-f]{40}$/i.test(atom.provenance.ref.value)
          && Boolean(atom.provenance.path) && /^[0-9a-f]{64}$/i.test(atom.provenance.contentSha256 ?? '')
        if (!pinned) invalidPublisherAtoms++
      }
      if (ids.has(atom.evidenceId)) duplicateEvidenceIds++
      ids.add(atom.evidenceId)
      sourceKinds[atom.provenance.sourceKind] = (sourceKinds[atom.provenance.sourceKind] ?? 0) + 1
    }
    const atomsById = new Map(evidence.atoms.map((atom) => [atom.evidenceId, atom]))
    for (const atom of evidence.atoms) {
      for (const id of atom.supersedesEvidenceIds ?? []) {
        const target = atomsById.get(id)
        if (!target) unresolvedSupersedes++
        else if (id === atom.evidenceId || target.subject !== atom.subject) invalidSupersedes++
      }
    }
    supersedeCycles += countSupersedeCycles(evidence.atoms)
    for (const claim of evidence.capabilities) {
      if (!validIds.has(claim.id)) invalidCapabilityIds.add(claim.id)
      else capabilityCounts[claim.id]++
      if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) malformedRecords++
      if (claim.decision === 'accepted') acceptedClaims++
      else if (claim.decision === 'provisional') provisionalClaims++
      else if (claim.decision === 'conflicted') conflictedClaims++
      else rejectedClaims++
      for (const id of [...claim.supportEvidenceIds, ...claim.contradictionEvidenceIds]) if (!ids.has(id)) unresolvedReferences++
      if (claim.decision === 'accepted') {
        const hasPinnedPublisher = claim.supportEvidenceIds.some((id) => {
          const atom = atomsById.get(id)
          return atom?.provenance.authority === 'publisher' && atom.provenance.ref?.kind === 'commit'
            && /^[0-9a-f]{40}$/i.test(atom.provenance.ref.value) && Boolean(atom.provenance.path)
            && /^[0-9a-f]{64}$/i.test(atom.provenance.contentSha256 ?? '')
        })
        if (!hasPinnedPublisher) acceptedClaimsWithoutPinnedPublisher++
      }
    }
    if (canonicalClaims(evidence.capabilities) !== canonicalClaims(computeCapabilityClaims(evidence.atoms, evidence.state))) staleClaims++
  }
  const invalid = [...invalidCapabilityIds].sort()
  const failedSources = index.sources.filter((source) => !source.ok).length
  const truncatedSources = index.sources.filter((source) => source.truncated === true).length
  const incompleteSources = index.sources.filter((source) => {
    if (source.reportedTotal === undefined || source.itemCount >= source.reportedTotal) return false
    // GitHub Search 的 total_count 会随扫描期间的 topic 增删变化。千级以上动态源
    // 允许 0.1%（至少 5 条）的自然漂移；小源保持精确一致。
    const tolerance = source.reportedTotal >= 1_000 ? Math.max(5, Math.ceil(source.reportedTotal * 0.001)) : 0
    return source.reportedTotal - source.itemCount > tolerance
  }).length
  const metaValid = index.evidenceMeta?.taxonomyVersion === TAXONOMY_VERSION
    && index.evidenceMeta.extractorVersion === EVIDENCE_EXTRACTOR_VERSION
    && index.evidenceMeta.ruleVersion === EVIDENCE_RULE_VERSION
  if (index.evidenceMeta) {
    const derivedState = legacyPlugins === 0 && pluginsWithEvidence === index.plugins.length ? 'complete' : 'legacy-partial'
    if (index.evidenceMeta.state !== derivedState) stateMismatches++
  }
  const structuralPass = index.schemaVersion === SCHEMA_VERSION && metaValid && malformedRecords === 0
    && unresolvedReferences === 0 && unresolvedSupersedes === 0 && invalidSupersedes === 0 && supersedeCycles === 0 && duplicateEvidenceIds === 0
    && staleClaims === 0 && stateMismatches === 0 && invalidPublisherAtoms === 0
    && acceptedClaimsWithoutPinnedPublisher === 0 && invalid.length === 0
  const releasePass = structuralPass && index.plugins.length > 0 && index.sources.length > 0
    && failedSources === 0 && truncatedSources === 0 && incompleteSources === 0 && publisherCompletePlugins > 0
    && pluginsWithEvidence === index.plugins.length
    && completePlugins === index.plugins.length && legacyPlugins === 0 && index.evidenceMeta?.state === 'complete'
  return {
    schemaVersion: index.schemaVersion,
    evidenceState: index.evidenceMeta?.state ?? 'legacy-partial',
    plugins: index.plugins.length,
    eligiblePlugins: index.plugins.filter(eligible).length,
    pluginsWithEvidence, completePlugins, atoms, acceptedClaims, provisionalClaims, conflictedClaims, rejectedClaims,
    malformedRecords, unresolvedReferences, duplicateEvidenceIds, unresolvedSupersedes, invalidSupersedes, supersedeCycles, staleClaims, stateMismatches, invalidCapabilityIds: invalid,
    legacyPlugins, failedSources, truncatedSources, incompleteSources, publisherCompletePlugins,
    invalidPublisherAtoms, acceptedClaimsWithoutPinnedPublisher, sourceKinds, capabilityCounts,
    structuralGate: structuralPass ? 'PASS' : 'FAIL',
    releaseGate: releasePass ? 'PASS' : 'FAIL',
    gate: structuralPass ? 'PASS' : 'FAIL',
  }
}
