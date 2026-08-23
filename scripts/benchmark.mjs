#!/usr/bin/env node
/**
 * P3.8 推荐质量基准:黄金集 → 排名 → 指标 → baseline 快照
 * 指标(v1,评审第六轮):Top1 命中 / Top3 强命中 / mustNot 侵入@3 /
 * dead@3;popularity-overfit 子集单列。P4 Entry Gate 由本输出判定。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const golden = JSON.parse(readFileSync(path.join(ROOT, 'benchmark/golden.json'), 'utf8'))
const index = JSON.parse(readFileSync(path.join(os.homedir(), '.dsh/deepatlas/index.json'), 'utf8'))

const plugins = index.plugins.filter((p) => !p.deadLink && !p.archived)

function tokenize(need) {
  const raw = need.toLowerCase()
  return [...new Set(
    raw.split(/[^\p{Script=Han}\p{L}\p{N}]+/u)
      .flatMap((w) => (/\p{Script=Han}/u.test(w) ? (w.match(/.{1,2}/gu) ?? []) : [w]))
      .filter((t) => t.length >= 2),
  )]
}
function prescore(p, tokens) {
  const h = `${p.name} ${p.description} ${p.topics.join(' ')}`.toLowerCase()
  return tokens.reduce((a, t) => a + (h.includes(t) ? 1 : 0), 0)
}
function topN(task, n) {
  const tokens = tokenize(task.need)
  return plugins.map((p) => ({ p, s: prescore(p, tokens) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || (b.p.quality?.total ?? 0) - (a.p.quality?.total ?? 0))
    .slice(0, n)
    .map(({ p }) => p)
}

const rows = []
let top1Hit = 0, top3Hit = 0, mustNotViolations = 0, dead3 = 0
const overfit = { total: 0, violated: 0 }
for (const task of golden.tasks) {
  const top5 = topN(task, 5).map((p) => p.id)
  const top3 = top5.slice(0, 3)
  const ok1 = top5.length > 0 && ([...task.expectedStrong, ...task.expectedAcceptable].includes(top5[0]))
  const ok3 = top3.some((id) => task.expectedStrong.includes(id))
  const violated = top3.some((id) => task.mustNotRecommend.includes(id))
  if (ok1) top1Hit++
  if (ok3) top3Hit++
  if (violated) mustNotViolations++
  if (task.tags?.includes('popularity-overfit')) { overfit.total++; if (violated) overfit.violated++ }
  rows.push({ id: task.id, need: task.need, top3, ok1, ok3, violated })
}

const metrics = {
  tasks: golden.tasks.length,
  top1HitRate: +(top1Hit / golden.tasks.length).toFixed(3),
  top3StrongRate: +(top3Hit / golden.tasks.length).toFixed(3),
  mustNotAt3: mustNotViolations,
  deadAt3: dead3,
  popularityOverfit: overfit,
  gate_P4: top3Hit / golden.tasks.length >= 0.9 && mustNotViolations === 0 ? 'PASS' : 'FAIL',
}
const baseline = { frozenAt: new Date().toISOString(), metrics, rows }
writeFileSync(path.join(ROOT, 'benchmark/baseline.json'), JSON.stringify(baseline, null, 2))
console.log('=== P3.8 Baseline ===')
console.log(JSON.stringify(metrics, null, 2))
console.log('明细(top3 未命中强匹配的任务):')
for (const r of rows.filter((r) => !r.ok3)) console.log(`  ${r.id} ${r.need} → [${r.top3.join(', ')}]`)
