import { describe, expect, it } from 'vitest'
import { activityScore, communityScore, trustScore, rank } from '../src/core/ranker.js'
import { PluginMeta } from '../src/types.js'

const NOW = new Date('2026-08-22T00:00:00Z')

function meta(partial: Partial<PluginMeta>): PluginMeta {
  return {
    id: 'owner/repo',
    name: 'dsh-demo',
    repoUrl: 'https://github.com/owner/repo',
    description: '',
    type: 'cordis',
    stars: 0,
    lastPushedAt: '',
    license: 'none',
    topics: [],
    whitelisted: false,
    provides: [],
    source: 'test',
    fetchedAt: NOW.toISOString(),
    ...partial,
  }
}

describe('activityScore', () => {
  it('7 天内满分,180 天以上归零,单调递减', () => {
    expect(activityScore('2026-08-20T00:00:00Z', NOW)).toBe(100)
    expect(activityScore('2026-02-01T00:00:00Z', NOW)).toBe(0)
    const week = activityScore('2026-08-15T00:00:00Z', NOW)
    const month = activityScore('2026-07-22T00:00:00Z', NOW)
    expect(week).toBeGreaterThan(month)
  })

  it('无效时间返回 0', () => {
    expect(activityScore('', NOW)).toBe(0)
    expect(activityScore('not-a-date', NOW)).toBe(0)
  })
})

describe('communityScore', () => {
  it('对数缩放(基数 15 万):0 星 0 分,头部有区分度', () => {
    expect(communityScore(0)).toBe(0)
    expect(communityScore(100)).toBeGreaterThan(communityScore(10))
    // 头部区分度:35k 与 387 不再同分(P2-A 验收发现的缺陷)
    expect(communityScore(35_022)).toBeGreaterThan(communityScore(387))
    expect(communityScore(183_457)).toBe(100)
  })
})

describe('trustScore', () => {
  it('白名单 +50,宽松协议 +30,dsh 前缀 +20,封顶 100', () => {
    expect(trustScore({ whitelisted: true, license: 'MIT', name: 'dsh-x' })).toBe(100)
    expect(trustScore({ whitelisted: false, license: 'MIT', name: 'dsh-x' })).toBe(50)
    expect(trustScore({ whitelisted: false, license: 'none', name: 'x' })).toBe(0)
  })
})

describe('rank', () => {
  it('总分为三分加权,match 恒为 0', () => {
    const q = rank(meta({ stars: 1000, lastPushedAt: '2026-08-20T00:00:00Z', license: 'MIT' }))
    expect(q.match).toBe(0)
    expect(q.activity).toBe(100)
    expect(q.community).toBe(58) // 新基数:千星级约 58 分
    // trust=50(MIT 30 + dsh 前缀 20)
    expect(q.total).toBe(Math.round(100 * 0.35 + 58 * 0.25 + 50 * 0.25))
  })
})
