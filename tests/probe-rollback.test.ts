import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { detectWorkspaceAbsorption } from '../src/core/probe.js'
import { snapshotProfile, restoreProfile, discardSnapshot } from '../src/core/rollback.js'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-probe-'))
})

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

describe('detectWorkspaceAbsorption(装前探针)', () => {
  it('干净目录:向上无 workspace → valid', async () => {
    const dir = path.join(root, 'a', 'b')
    await fs.mkdir(dir, { recursive: true })
    expect(detectWorkspaceAbsorption(dir, root).valid).toBe(true)
  })

  it('祖先有 pnpm-workspace.yaml → 拒绝并指出根', async () => {
    const dir = path.join(root, 'proj', 'staging')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(root, 'proj', 'pnpm-workspace.yaml'), 'packages:\n  - *\n')
    const r = detectWorkspaceAbsorption(dir, root)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('pnpm workspace')
    expect(r.workspaceRoot).toBe(path.resolve(root, 'proj'))
  })

  it('祖先 package.json 含 workspaces 字段 → 拒绝', async () => {
    const dir = path.join(root, 'mono', 'pkg')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(root, 'mono', 'package.json'), JSON.stringify({ workspaces: ['pkg/*'] }))
    const r = detectWorkspaceAbsorption(dir, root)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('workspaces')
  })

  it('普通 package.json(无 workspaces)不误伤', async () => {
    const dir = path.join(root, 'app', 'sub')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(root, 'app', 'package.json'), JSON.stringify({ name: 'x' }))
    expect(detectWorkspaceAbsorption(dir, root).valid).toBe(true)
  })
})

describe('snapshot/restore(回滚)', () => {
  it('快照→修改→恢复:关键文件还原', async () => {
    const dir = path.join(root, 'profile-web')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'package.json'), '{"name":"before"}')
    await fs.writeFile(path.join(dir, 'cordis.patch.yml'), '# before')

    const snap = await snapshotProfile(dir)
    expect(snap.files.sort()).toEqual(['cordis.patch.yml', 'package.json'])

    await fs.writeFile(path.join(dir, 'package.json'), '{"name":"after","dep":true}')
    const { restored } = await restoreProfile(snap)
    expect(restored).toContain('package.json')
    expect(await fs.readFile(path.join(dir, 'package.json'), 'utf8')).toBe('{"name":"before"}')

    await discardSnapshot(dir)
    await expect(fs.access(path.join(dir, '.deepatlas-backup'))).rejects.toThrow()
  })

  it('缺失文件不入快照,恢复不报错', async () => {
    const dir = path.join(root, 'profile-slim')
    await fs.mkdir(dir, { recursive: true })
    const snap = await snapshotProfile(dir)
    expect(snap.files).toEqual([])
    await expect(restoreProfile(snap)).resolves.toEqual({ restored: [] })
  })
})
