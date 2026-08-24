import { describe, expect, it } from 'vitest'
import { computeCapabilityClaims, evidenceFromObservations, extractCapabilityEvidence } from '../src/core/capabilities.js'
import { buildEvidenceReport } from '../src/core/evidence-report.js'
import { retrieve } from '../src/core/retrieval.js'
import type { AtlasIndex, PluginMeta } from '../src/types.js'

function plugin(): PluginMeta {
  return {
    id: 'owner/dsh-browser', name: 'dsh-browser', repoUrl: '', description: '', type: 'cordis',
    stars: 1, lastPushedAt: '', license: 'MIT', topics: [], whitelisted: false, provides: [],
    source: 'test', fetchedAt: '',
  }
}

function provenance(
  authority: 'publisher' | 'platform' | 'community' | 'legacy' = 'publisher',
  observedAt = '2026-01-01T00:00:00Z',
) {
  return {
    sourceId: `${authority}-fixture`,
    sourceKind: authority === 'community' ? 'awesome-list' as const : 'manifest' as const,
    authority,
    repository: 'owner/dsh-browser',
    ref: { kind: 'commit' as const, value: 'a'.repeat(40) },
    path: 'package.json',
    contentSha256: 'b'.repeat(64),
    observedAt,
    originGroup: `${authority}:owner/dsh-browser`,
  }
}

describe('Evidence v2', () => {
  it('保存可审计来源，且同一 originGroup 不叠加置信度', () => {
    const evidence = extractCapabilityEvidence([
      { source: 'name', text: 'dsh-browser' },
      { source: 'topics', text: 'browser-automation' },
      { source: 'description', text: 'Control Chrome safely' },
    ])
    const browser = evidence.capabilities.find((record) => record.id === 'browser-automation')!
    expect(evidence.schemaVersion).toBe(2)
    expect(browser.decision).toBe('accepted')
    expect(browser.confidence).toBe(0.8)
    expect(browser.supportEvidenceIds.length).toBe(3)
  })

  it('名称单证据保持 rejected', () => {
    const evidence = extractCapabilityEvidence([{ source: 'name', text: 'browser-helper' }])
    expect(evidence.capabilities.find((claim) => claim.id === 'browser-automation')).toMatchObject({ decision: 'rejected', confidence: 0.4 })
  })

  it('legacy 观察值上限 0.35，结构仍可通过 Gate', () => {
    const observations = [{
      values: { name: 'search-tool', description: 'web search', topics: [], provides: [] },
      provenance: { sourceId: 'v1', sourceKind: 'legacy-index' as const, authority: 'legacy' as const, repository: 'owner/search', observedAt: '2026-01-01T00:00:00Z', originGroup: 'legacy:owner/search' },
    }]
    const evidence = evidenceFromObservations(observations, 'legacy-partial')
    expect(evidence.capabilities.find((claim) => claim.id === 'web-search')).toMatchObject({ decision: 'rejected', confidence: 0.35 })
    const index: AtlasIndex = {
      schemaVersion: 2, builtAt: '', sources: [], plugins: [{ ...plugin(), observations, evidence }],
      evidenceMeta: { taxonomyVersion: 'capability-taxonomy-v1', extractorVersion: 'capability-evidence-v2.0.0', ruleVersion: 'capability-claims-v2.0.0', state: 'legacy-partial', migratedFrom: 1 },
    }
    const report = buildEvidenceReport(index)
    expect(report.gate).toBe('PASS')
    expect(report.structuralGate).toBe('PASS')
    expect(report.releaseGate).toBe('FAIL')
    expect(report.legacyPlugins).toBe(1)
  })

  it.each([
    [{ sourceId: 'github-topic', ok: false, itemCount: 0, fetchedAt: '2026-01-01T00:00:00Z', error: 'rate limit' }, 'failedSources'],
    [{ sourceId: 'github-topic', ok: true, itemCount: 1, fetchedAt: '2026-01-01T00:00:00Z', truncated: true }, 'truncatedSources'],
    [{ sourceId: 'github-topic', ok: true, itemCount: 1, reportedTotal: 2, fetchedAt: '2026-01-01T00:00:00Z' }, 'incompleteSources'],
  ] as const)('数据源不完整时结构 Gate 可通过，发布 Gate 失败：%s', (source, metric) => {
    const observations = [{
      values: { name: 'browser-helper', description: '', topics: [], provides: [] },
      provenance: provenance(),
    }]
    const index: AtlasIndex = {
      schemaVersion: 2,
      evidenceMeta: { taxonomyVersion: 'capability-taxonomy-v1', extractorVersion: 'capability-evidence-v2.0.0', ruleVersion: 'capability-claims-v2.0.0', state: 'complete' },
      builtAt: '2026-01-01T00:00:00Z', sources: [source],
      plugins: [{ ...plugin(), observations, evidence: evidenceFromObservations(observations, 'complete') }],
    }
    const report = buildEvidenceReport(index)
    expect(report.structuralGate).toBe('PASS')
    expect(report.releaseGate).toBe('FAIL')
    expect(report[metric]).toBe(1)
  })

  it('原生 v2 空 claims 不回退到插件文本猜测', () => {
    const candidate = {
      ...plugin(),
      description: 'web search browser automation',
      evidence: { schemaVersion: 2 as const, state: 'complete' as const, atoms: [], capabilities: [] },
    }
    expect(retrieve('联网查资料', [candidate])).toHaveLength(0)
  })

  it('结构化否定形成冲突，supersede 后旧支持项退出 claim', () => {
    const supportPart = {
      source: 'manifest-capability' as const,
      text: 'browser-automation',
      capabilityId: 'browser-automation',
      provenance: provenance(),
    }
    const first = extractCapabilityEvidence([supportPart])
    const supportId = first.atoms[0].evidenceId
    const contradictionPart = {
      ...supportPart,
      text: 'browser automation disabled',
      polarity: 'contradicts' as const,
      provenance: { ...provenance(), ref: { kind: 'commit' as const, value: 'b'.repeat(40) } },
    }
    const conflicted = extractCapabilityEvidence([supportPart, contradictionPart])
    expect(conflicted.capabilities[0]).toMatchObject({ id: 'browser-automation', decision: 'conflicted' })

    const superseding = { ...contradictionPart, supersedesEvidenceIds: [supportId] }
    const resolved = extractCapabilityEvidence([supportPart, superseding])
    expect(resolved.capabilities[0]).toMatchObject({ id: 'browser-automation', decision: 'rejected', confidence: 0 })
    expect(resolved.capabilities[0].supportEvidenceIds).toEqual([])
    expect(resolved.capabilities[0].contradictionEvidenceIds).toHaveLength(1)
  })

  it('输入顺序不影响 Evidence JSON，采集时间不影响 evidenceId', () => {
    const a = { source: 'description' as const, text: 'browser automation', provenance: provenance('publisher') }
    const b = { source: 'readme' as const, text: 'browser automation', provenance: provenance('community') }
    expect(JSON.stringify(extractCapabilityEvidence([a, b]))).toBe(JSON.stringify(extractCapabilityEvidence([b, a])))

    const later = { ...a, provenance: provenance('publisher', '2026-02-01T00:00:00Z') }
    expect(extractCapabilityEvidence([a]).atoms[0].evidenceId).toBe(extractCapabilityEvidence([later]).atoms[0].evidenceId)
  })

  it('独立 authority 只提供受限加分，同 authority 多来源不叠加', () => {
    const publisher = { source: 'description' as const, text: 'browser automation', provenance: provenance('publisher') }
    const platform = { source: 'description' as const, text: 'browser automation', provenance: provenance('platform') }
    const sameAuthority = {
      source: 'readme' as const,
      text: 'browser automation',
      provenance: { ...provenance('publisher'), originGroup: 'publisher:mirror' },
    }
    expect(extractCapabilityEvidence([publisher, sameAuthority]).capabilities[0].confidence).toBe(0.7)
    expect(extractCapabilityEvidence([publisher, platform]).capabilities[0].confidence).toBe(0.75)
  })

  it('legacy-partial 保留低置信 capability fallback，原生 rejected 不获得 boost', () => {
    const legacyObservation = [{
      values: { name: 'search-tool', description: 'web search', topics: [], provides: [] },
      provenance: { ...provenance('legacy'), sourceKind: 'legacy-index' as const },
    }]
    const legacyCandidate = { ...plugin(), name: 'neutral', evidence: evidenceFromObservations(legacyObservation, 'legacy-partial') }
    const legacyResult = retrieve('find material', [legacyCandidate], 30, ['web-search'])
    expect(legacyResult).toHaveLength(1)
    expect(legacyResult[0].capabilityEvidence[0]).toMatchObject({ id: 'web-search', decision: 'rejected', confidence: 0.35 })

    const nativeWeak = { ...plugin(), name: 'neutral', evidence: extractCapabilityEvidence([{ source: 'name', text: 'browser-helper' }]) }
    expect(retrieve('do task', [nativeWeak], 30, ['browser-automation'])).toHaveLength(0)
  })

  it('发布 Gate 拒绝非法或成环的 supersede 关系', () => {
    const base = extractCapabilityEvidence([{
      source: 'manifest-capability', text: 'browser-automation', capabilityId: 'browser-automation', provenance: provenance(),
    }])
    const first = base.atoms[0]
    const second = { ...first, evidenceId: 'replacement', supersedesEvidenceIds: [first.evidenceId] }
    first.supersedesEvidenceIds = [second.evidenceId]
    const evidence = { ...base, atoms: [first, second], capabilities: [] }
    evidence.capabilities = computeCapabilityClaims(evidence.atoms, evidence.state)
    const index: AtlasIndex = {
      schemaVersion: 2, builtAt: new Date().toISOString(), sources: [], plugins: [{ ...plugin(), evidence }],
      evidenceMeta: { taxonomyVersion: 'capability-taxonomy-v1', extractorVersion: 'capability-evidence-v2.0.0', ruleVersion: 'capability-claims-v2.0.0', state: 'complete' },
    }
    const report = buildEvidenceReport(index)
    expect(report.supersedeCycles).toBe(2)
    expect(report.releaseGate).toBe('FAIL')
  })
})
