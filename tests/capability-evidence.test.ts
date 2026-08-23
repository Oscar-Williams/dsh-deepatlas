import { describe, expect, it } from 'vitest'
import { evidenceFromObservations, extractCapabilityEvidence } from '../src/core/capabilities.js'
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
    expect(report.legacyPlugins).toBe(1)
  })

  it('原生 v2 空 claims 不回退到插件文本猜测', () => {
    const candidate = {
      ...plugin(),
      description: 'web search browser automation',
      evidence: { schemaVersion: 2 as const, state: 'complete' as const, atoms: [], capabilities: [] },
    }
    expect(retrieve('联网查资料', [candidate])).toHaveLength(0)
  })
})
