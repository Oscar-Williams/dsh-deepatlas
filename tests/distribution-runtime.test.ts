/**
 * These tests intentionally import committed lib/, the payload reached through
 * package.json main/exports during a GitHub installation. Source-only tests
 * cannot detect a stale distribution build.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildInstallTool } from '../lib/tools/install.js'
import { AuditCache } from '../lib/core/audit-cache.js'
import { buildAuditReportV1 } from '../lib/core/audit-v1.js'
import { buildPluginRecord } from '../lib/core/record.js'
import { dshInvocation } from '../lib/core/dsh-cli.js'
import { discardSnapshot, restoreProfile, snapshotProfile } from '../lib/core/rollback.js'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-dist-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

describe('committed distribution runtime', () => {
  it('enforces cache identity and produces a factual dry-run plan', async () => {
    const sha = 'a'.repeat(40)
    const manifest = { name: 'dsh-hot', version: '1.0.0', license: 'MIT' }
    const valid = {
      ...buildAuditReportV1({ target: 'a/hot', manifest, commitPinned: true, whitelisted: true }),
      auditedRef: sha,
      compatibility: { ok: true },
      pluginRecord: buildPluginRecord('a/hot', manifest),
    }
    const cache = new AuditCache(dir)
    await cache.put('a/hot', sha, { ...valid, auditedRef: 'b'.repeat(40) })
    const config = {
      dataDir: dir, installProfile: 'web', indexTtlHours: 24,
      minStars: 0, githubTokenEnv: 'TEST_TOKEN', dryRun: true,
    }
    const tool = buildInstallTool({} as never, config)
    await expect(tool.execute({ target: 'a/hot', commit: sha, userConsent: true }))
      .resolves.toMatchObject({ ok: false, plan: { state: 'REJECTED_AUDIT' } })

    await cache.put('a/hot', sha, valid)
    await expect(tool.execute({ target: 'a/hot', commit: sha, userConsent: true }))
      .resolves.toMatchObject({
        ok: true, dryRun: true, executed: false, composed: false, active: false,
        plan: { state: 'PLANNED' },
      })
  })

  it('restores files created after the snapshot and removes the unique backup', async () => {
    const snapshot = await snapshotProfile(dir)
    await fs.writeFile(path.join(dir, 'pnpm-lock.yaml'), 'lockfileVersion: 9')
    await restoreProfile(snapshot)
    await expect(fs.access(path.join(dir, 'pnpm-lock.yaml'))).rejects.toThrow()
    await discardSnapshot(snapshot)
    await expect(fs.access(snapshot.snapshotDir)).rejects.toThrow()
  })

  it('ships the controlled Windows fallback invocation', () => {
    expect(dshInvocation(['--version'], {
      argv: ['node', 'runner.js'], execPath: 'node', platform: 'win32',
    })).toEqual({
      command: process.env.ComSpec ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'dsh.cmd', '--version'],
    })
  })
})
