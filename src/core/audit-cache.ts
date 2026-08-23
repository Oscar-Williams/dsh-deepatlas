/**
 * 内容寻址审计缓存(P3.5-D)
 * key = sha256(repo#commit | auditor-vN):commit 变更自动失效,
 * 规则版本升级自动失效(评审:不要按 repo 缓存)。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { AuditReportV1 } from './audit-v1.js'
import type { PluginRecord } from './record.js'

export interface CachedAuditReport extends AuditReportV1 {
  auditedRef?: string
  compatibility?: { ok: boolean; reasons?: string[] }
  pluginRecord?: PluginRecord
}

// Fail-closed manifest/source coverage and cache-derived install authorization
// changed the trust contract. Never reuse entries created under older rules.
export const AUDITOR_VERSION = 'audit-v3'

export function cacheKey(repo: string, commit: string): string {
  return createHash('sha256').update(`${repo}#${commit}|${AUDITOR_VERSION}`).digest('hex').slice(0, 24)
}

export class AuditCache {
  private readonly file: string
  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'audit-cache.json')
  }

  async load(): Promise<Record<string, { at: string; report: CachedAuditReport }>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8')) as Record<string, { at: string; report: CachedAuditReport }>
    } catch {
      return {}
    }
  }

  async get(repo: string, commit: string): Promise<CachedAuditReport | null> {
    const all = await this.load()
    return all[cacheKey(repo, commit)]?.report ?? null
  }

  async put(repo: string, commit: string, report: CachedAuditReport): Promise<void> {
    const all = await this.load()
    all[cacheKey(repo, commit)] = { at: new Date().toISOString(), report }
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    const tmp = `${this.file}.${process.pid}.${randomUUID()}.tmp`
    try {
      await fs.writeFile(tmp, JSON.stringify(all, null, 2), 'utf8')
      await fs.rename(tmp, this.file)
    } finally {
      await fs.rm(tmp, { force: true })
    }
  }
}
