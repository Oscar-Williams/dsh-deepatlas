import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { buildFindTool } from '../src/tools/find.js'
import { IndexStore, SCHEMA_VERSION } from '../src/core/index-store.js'
import { DeepAtlasConfig } from '../src/config.js'
import { AtlasIndex, PluginMeta } from '../src/types.js'
import { extractCapabilityEvidence } from '../src/core/capabilities.js'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-find-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

function meta(p: Partial<PluginMeta>): PluginMeta {
  return {
    id: 'a/x', name: 'dsh-x', repoUrl: 'https://github.com/a/x', description: '',
    type: 'cordis', stars: 0, lastPushedAt: '', license: 'MIT', topics: [],
    whitelisted: false, provides: [], source: 'test', fetchedAt: new Date().toISOString(),
    ...p,
  }
}

const mkConfig = (): DeepAtlasConfig => ({
  dataDir: dir, installProfile: 'web', indexTtlHours: 24, minStars: 0,
  githubTokenEnv: 'TEST_TOKEN', dryRun: true,
})

describe('deepatlas_find 工具', () => {
  it('返回候选 + runtime 上下文 + 审计引导', async () => {
    const index: AtlasIndex = {
      schemaVersion: SCHEMA_VERSION,
      builtAt: new Date().toISOString(),
      sources: [],
      plugins: [
        meta({ id: 'a/browser', name: 'dsh-browser', description: '让 DSH 操作真实 Chrome 浏览器', stars: 64, lastPushedAt: new Date().toISOString() }),
        meta({ id: 'a/mem', name: 'dsh-memory', description: '跨会话长期记忆', stars: 30, lastPushedAt: new Date().toISOString() }),
      ],
    }
    await new IndexStore(dir).save(index)

    const tool = buildFindTool({} as never, mkConfig())
    const result = (await (tool as { execute: (a: unknown) => Promise<Record<string, unknown>> }).execute({ need: '浏览器 自动化' })) as {
      ok: boolean
      candidates: { plugin: PluginMeta }[]
      runtime: { platform: string; node: string; note: string }
    }

    expect(result.ok).toBe(true)
    expect(result.candidates[0].plugin.id).toBe('a/browser')
    expect(result.runtime.platform).toContain(process.platform)
    expect(result.runtime.note).toContain('deepatlas_audit')
  })

  it('检索 v2:能力命中进理由', async () => {
    const index: AtlasIndex = {
      schemaVersion: SCHEMA_VERSION,
      builtAt: new Date().toISOString(),
      sources: [],
      plugins: [meta({ id: 'a/skin', name: 'dsh-skin', description: '界面 皮肤 美化 theme', stars: 10, evidence: extractCapabilityEvidence([{ source: 'topics', text: 'ui-theme' }]) })],
    }
    await new IndexStore(dir).save(index)
    const tool = buildFindTool({} as never, mkConfig())
    const result = (await (tool as { execute: (a: unknown) => Promise<Record<string, unknown>> }).execute({ need: '换个好看的主题外观' })) as {
      candidates: { reason: string }[]
    }
    expect(result.candidates.length).toBeGreaterThan(0)
    expect(result.candidates[0].reason).toContain('任务匹配')
  })

  it('索引不存在时给出引导', async () => {
    const tool = buildFindTool({} as never, mkConfig())
    const result = (await (tool as { execute: (a: unknown) => Promise<Record<string, unknown>> }).execute({ need: 'x' })) as { ok: boolean; message: string }
    expect(result.ok).toBe(false)
    expect(result.message).toContain('deepatlas_scan')
  })
})
