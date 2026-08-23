/**
 * Profile 快照与回滚(P3.5-lite)
 *
 * 安装前快照 profile 关键文件;安装/组合/启动验证失败时恢复,
 * 输出"已还原到安装前状态"。依赖目录(node_modules)不回滚——
 * package.json 恢复后,dsh 下次 plugin 操作会按清单 reconcile 清理。
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const SNAPSHOT_FILES = ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', 'pnpm-lock.yaml']

export interface ProfileSnapshot {
  profileDir: string
  snapshotDir: string
  files: string[]
  absent: string[]
  at: string
}

export async function snapshotProfile(profileDir: string): Promise<ProfileSnapshot> {
  const snapDir = path.join(profileDir, `.deepatlas-backup-${randomUUID()}`)
  await fs.mkdir(snapDir, { recursive: true })
  const saved: string[] = []
  const absent: string[] = []
  for (const name of SNAPSHOT_FILES) {
    const src = path.join(profileDir, name)
    try {
      await fs.copyFile(src, path.join(snapDir, name))
      saved.push(name)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') absent.push(name)
      else throw error
    }
  }
  return { profileDir, snapshotDir: snapDir, files: saved, absent, at: new Date().toISOString() }
}

export async function restoreProfile(snap: ProfileSnapshot): Promise<{ restored: string[] }> {
  const restored: string[] = []
  for (const name of snap.files) {
    await fs.copyFile(path.join(snap.snapshotDir, name), path.join(snap.profileDir, name))
    restored.push(name)
  }
  for (const name of snap.absent) {
    await fs.rm(path.join(snap.profileDir, name), { force: true })
  }
  return { restored }
}

/** 丢弃快照(安装成功后调用,不留垃圾) */
export async function discardSnapshot(snap: ProfileSnapshot): Promise<void> {
  await fs.rm(snap.snapshotDir, { recursive: true, force: true })
}
