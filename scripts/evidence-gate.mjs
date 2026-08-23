#!/usr/bin/env node
import os from 'node:os'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { IndexStore } from '../lib/core/index-store.js'
import { buildEvidenceReport } from '../lib/core/evidence-report.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.DEEPATLAS_HOME ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const store = new IndexStore(path.join(base, 'deepatlas'))
const index = await store.load()
if (!index) {
  console.error('DeepAtlas 索引不存在或无法迁移；请先运行 deepatlas_scan。')
  process.exit(2)
}
const report = buildEvidenceReport(index)
const result = { at: new Date().toISOString(), metrics: report }
writeFileSync(path.join(root, 'benchmark/evidence-result.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (report.gate !== 'PASS') process.exitCode = 1
