/**
 * 本地索引存储:JSON 文件读写、过期判断
 * 数据仅存本地,不上传(任务书安全红线 3)。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { AtlasIndex } from '../types'

export const SCHEMA_VERSION = 1

export function defaultDataDir(explicit?: string): string {
  if (explicit && explicit.trim()) return explicit
  const base = process.env.DEEPATLAS_HOME ?? path.join(os.homedir(), '.dsh')
  return path.join(base, 'deepatlas')
}

export class IndexStore {
  private readonly filePath: string

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, 'index.json')
  }

  get location(): string {
    return this.filePath
  }

  async load(): Promise<AtlasIndex | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as AtlasIndex
      if (parsed.schemaVersion !== SCHEMA_VERSION) return null // 版本不符视为需重建
      return parsed
    } catch {
      return null
    }
  }

  async save(index: AtlasIndex): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf8')
    await fs.rename(tmp, this.filePath) // 原子替换,避免写一半损坏索引
  }

  /** 索引是否已过期(TTL 小时) */
  isStale(index: AtlasIndex, ttlHours: number): boolean {
    if (ttlHours <= 0) return false
    const ageMs = Date.now() - Date.parse(index.builtAt)
    return Number.isNaN(ageMs) || ageMs > ttlHours * 3600_000
  }
}
