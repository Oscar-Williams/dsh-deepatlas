#!/usr/bin/env node
import os from 'node:os'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { IndexStore } from '../lib/core/index-store.js'
import { buildEvidenceReport } from '../lib/core/evidence-report.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)

function option(name) {
  const position = args.indexOf(name)
  if (position < 0) return undefined
  const value = args[position + 1]
  if (!value || value.startsWith('--')) {
    console.error(`参数 ${name} 需要一个值。`)
    process.exit(2)
  }
  return value
}

const mode = option('--mode') ?? 'release'
if (mode !== 'release' && mode !== 'structural') {
  console.error('--mode 仅支持 release 或 structural。')
  process.exit(2)
}
const base = process.env.DEEPATLAS_HOME ?? process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
const dataDir = path.resolve(option('--data-dir') ?? path.join(base, 'deepatlas'))
const output = option('--output')
const store = new IndexStore(dataDir)
const index = await store.load()
if (!index) {
  console.error('DeepAtlas 索引不存在或无法迁移；请先运行 deepatlas_scan。')
  process.exit(2)
}
const report = buildEvidenceReport(index)
const requiredGate = mode === 'release' ? report.releaseGate : report.structuralGate
const result = { at: new Date().toISOString(), mode, requiredGate, metrics: report }
if (!args.includes('--no-write')) {
  writeFileSync(path.resolve(output ?? path.join(root, 'benchmark/evidence-result.json')), `${JSON.stringify(result, null, 2)}\n`)
}
console.log(JSON.stringify(report, null, 2))
if (requiredGate !== 'PASS') process.exitCode = 1
