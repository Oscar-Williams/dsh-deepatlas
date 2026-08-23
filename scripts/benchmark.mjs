#!/usr/bin/env node
/**
 * P3.8 基准 v3:直接 import 生产检索(lib/core/retrieval)——基准测的
 * 就是用户拿到的逻辑。支持 --explain <id> / --set dev|holdout。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { retrieve } from '../lib/core/retrieval.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv
const explainId = args.includes('--explain') ? args[args.indexOf('--explain') + 1] : null
const set = args.includes('--holdout') ? 'holdout' : 'dev'

const golden = JSON.parse(readFileSync(path.join(ROOT, `benchmark/${set === 'dev' ? 'golden' : 'holdout'}.json`), 'utf8'))
const index = JSON.parse(readFileSync(path.join(os.homedir(), '.dsh/deepatlas/index.json'), 'utf8'))

const rows = []
let top1Hit = 0, top3Hit = 0, top3SA = 0, recall20 = 0, mustNotViolations = 0, nonInstallable3 = 0
const catStats = {}, failClass = { recall: 0, filter: 0, rank: 0 }

for (const task of golden.tasks) {
  const pool = retrieve(task.need, index.plugins, 30)
  const ids20 = pool.map(({ plugin }) => plugin.id).slice(0, 20)
  const top3 = ids20.slice(0, 3)
  const strong = task.expectedStrong
  const sa = [...task.expectedStrong, ...task.expectedAcceptable]
  const in20 = sa.some((id) => ids20.includes(id))
  const ok1 = ids20.length > 0 && sa.includes(ids20[0])
  const ok3 = top3.some((id) => strong.includes(id))
  const ok3sa = top3.some((id) => sa.includes(id))
  const violated = top3.some((id) => task.mustNotRecommend.includes(id))
  const nonInst = top3.filter((id) => {
    const p = index.plugins.find((x) => x.id === id)
    const k = p?.kind ?? 'plugin'
    return k === 'framework' || k === 'collection' || k === 'documentation'
  }).length
  if (in20) recall20++
  if (ok1) top1Hit++
  if (ok3) top3Hit++
  if (ok3sa) top3SA++
  if (violated) mustNotViolations++
  nonInstallable3 += nonInst

  let failure = null
  if (!ok3) {
    const inRaw = index.plugins.some((p) => sa.includes(p.id))
    failure = !inRaw ? 'recall' : !in20 ? 'filter' : 'rank'
    failClass[failure]++
  }
  const cat = task.category
  catStats[cat] = catStats[cat] ?? { n: 0, ok3: 0 }
  catStats[cat].n++
  if (ok3) catStats[cat].ok3++
  rows.push({ id: task.id, category: cat, need: task.need, top3, ids20, ok1, ok3, ok3sa, in20, violated, failure, expected: sa })
}

if (explainId) {
  const row = rows.find((r) => r.id === explainId)
  const task = golden.tasks.find((t) => t.id === explainId)
  if (!row) { console.error(`未找到 ${explainId}`); process.exit(1) }
  const pool = retrieve(task.need, index.plugins, 30)
  console.log(`=== Explain ${task.id}(${set})===\n任务: ${task.need}`)
  console.log(`期望: strong=[${task.expectedStrong.join(', ')}] acceptable=[${task.expectedAcceptable.join(', ')}]`)
  pool.slice(0, 10).forEach(({ plugin, taskScore, capOverlap }, i) => {
    console.log(`  #${i + 1} ${plugin.id} task=${taskScore} caps=[${capOverlap.join(',')}] q=${plugin.quality?.total ?? 0}`)
  })
  console.log(`Recall@20: ${row.in20 ? 'YES' : 'NO —— EXPECTED NOT RETRIEVED'}`)
  console.log(`失败分类: ${row.failure ?? '通过'}`)
  process.exit(0)
}

const N = golden.tasks.length
const metrics = {
  set, tasks: N,
  candidateRecallAt20: +(recall20 / N).toFixed(3),
  top1HitRate: +(top1Hit / N).toFixed(3),
  top3StrongRate: +(top3Hit / N).toFixed(3),
  top3StrongOrAcceptable: +(top3SA / N).toFixed(3),
  mustNotAt3: mustNotViolations,
  nonInstallableAt3: nonInstallable3,
  failClass,
  byCategory: Object.fromEntries(Object.entries(catStats).map(([c, s]) => [c, `${s.ok3}/${s.n}`])),
  gate_P4: recall20 / N >= 0.95 && top3SA / N >= 0.9 && top3Hit / N >= 0.7 && mustNotViolations === 0 && nonInstallable3 === 0 ? 'PASS' : 'FAIL',
}
writeFileSync(path.join(ROOT, `benchmark/${set === 'dev' ? 'baseline' : 'holdout-result'}.json`), JSON.stringify({ frozenAt: new Date().toISOString(), metrics, rows }, null, 2))
console.log(`=== P3.8 ${set} ===`)
console.log(JSON.stringify(metrics, null, 2))
if (set === 'dev') {
  console.log('\n未命中:')
  for (const r of rows.filter((r) => !r.ok3)) console.log(`  [${r.failure}] ${r.id} ${r.need} → [${r.top3.join(', ')}]`)
}
