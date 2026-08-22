import { describe, expect, it } from 'vitest'
import { buildPluginRecord, toRequirement } from '../src/core/record.js'
import { readFileSync } from 'node:fs'

const risky = JSON.parse(
  readFileSync(new URL('./fixtures/risky-plugin/package.json', import.meta.url), 'utf8'),
) as Record<string, unknown>

describe('buildPluginRecord', () => {
  it('从清单抽取:构建脚本/依赖计数/engines;未知依赖不算 native', () => {
    const r = buildPluginRecord('a/risky', { ...risky, engines: { node: '>=22' } })
    expect(r.declaresBundle).toBe(false)
    expect(r.buildScripts).toContain('postinstall')
    expect(r.nativeDependencies).toEqual([]) // mystery-helper 不在已知 native 清单
    expect(r.enginesNode).toBe('>=22')
    expect(r.dependencyCount).toBe(2)
  })

  it('无清单时回落索引元数据并标注证据缺失', () => {
    const r = buildPluginRecord('a/b', null, { name: 'dsh-b', type: 'cordis', license: 'MIT' })
    expect(r.name).toBe('dsh-b')
    expect(r.type).toBe('cordis')
    expect(r.enginesNode).toBeUndefined()
    expect(r.evidence).not.toContain('package.json')
  })

  it('declaresBundle 识别 dsh.bundle 声明(本项目自身形态)', () => {
    const r = buildPluginRecord('me/dsh-deepatlas', {
      name: 'dsh-deepatlas',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    })
    expect(r.declaresBundle).toBe(true)
  })

  it('toRequirement 正确转接', () => {
    const r = buildPluginRecord('a/b', { engines: { node: '>=24' }, dependencies: { koffi: '^3' } })
    const q = toRequirement(r)
    expect(q.enginesNode).toBe('>=24')
    expect(q.nativeDependencies).toEqual(['koffi'])
  })
})
