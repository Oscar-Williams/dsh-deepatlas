import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { buildAdviseTool } from '../src/tools/advise.js'
import { extractCapabilityEvidence } from '../src/core/capabilities.js'
import { IndexStore, SCHEMA_VERSION } from '../src/core/index-store.js'
import { DeepAtlasConfig } from '../src/config.js'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-advise-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const mkConfig = (): DeepAtlasConfig => ({
  dataDir: dir, installProfile: 'web', indexTtlHours: 24, minStars: 0,
  githubTokenEnv: 'TEST_TOKEN', dryRun: true,
})

async function seedIndex(installed: string[] = []) {
  const plugin = (id: string, name: string, desc: string) => ({
    id, name, repoUrl: '', description: desc, type: 'cordis', stars: 10,
    lastPushedAt: new Date().toISOString(), license: 'MIT', topics: [],
    whitelisted: false, provides: [], source: 't', fetchedAt: new Date().toISOString(),
  })
  await new IndexStore(dir).save({
    schemaVersion: SCHEMA_VERSION, builtAt: new Date().toISOString(), sources: [],
    evidenceMeta: { taxonomyVersion: 'capability-taxonomy-v1', extractorVersion: 'capability-evidence-v2.0.0', ruleVersion: 'capability-claims-v2.0.0', state: 'complete' },
    plugins: [
      { ...plugin('a/im', 'dsh-im', '微信 收发消息 wechat 机器人'), displayName: 'dsh-im', evidence: extractCapabilityEvidence([{ source: 'provides', text: 'messaging-wechat' }]) },
      { ...plugin('a/mem', 'dsh-memory', '跨会话 长期记忆 记住 进度'), displayName: 'dsh-memory', evidence: extractCapabilityEvidence([{ source: 'provides', text: 'long-term-memory' }]) },
    ],
  })
  const dump = installed.map((n) => `- id: x\n  name: '${n}'`).join('\n')
  return async () => dump
}

describe('deepatlas_advise(P4.1 安静顾问)', () => {
  it('缺口存在且未安装 → 给出建议', async () => {
    await seedIndex()
    const tool = buildAdviseTool({} as never, mkConfig(), async () => '')
    const r = await tool.execute({ task: '帮我把 DSH 接入微信收消息' })
    expect(r.silent).toBe(false)
    expect(JSON.stringify(r.recommendations)).toContain('dsh-im')
  })

  it('能力已安装 → 保持安静(按 capabilities 判断)', async () => {
    await seedIndex()
    const tool = buildAdviseTool({} as never, mkConfig(), async () => "- id: im\n  name: 'dsh-im'")
    const r = await tool.execute({ task: '帮我把 DSH 接入微信收消息' })
    expect(r.silent).toBe(true)
    expect(r.reason).toContain('已具备')
  })

  it('无匹配 → 安静', async () => {
    await seedIndex()
    const tool = buildAdviseTool({} as never, mkConfig(), async () => '')
    const r = await tool.execute({ task: '帮我做三维建模渲染' })
    expect(r.silent).toBe(true)
  })
})
