#!/usr/bin/env node
/**
 * P3.8 推荐质量基准 v2(评审第八轮 ⑦.1 诊断先行)
 * 新增:Candidate Recall@20 / 分类指标 / --explain 逐案追踪 /
 * 失败三分类(召回失败 recall / 过滤失败 filter / 排序失败 rank)。
 * 用法:node scripts/benchmark.mjs [--explain t07]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { classifyKind, isInstallable } from '../lib/core/kind.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const golden = JSON.parse(readFileSync(path.join(ROOT, 'benchmark/golden.json'), 'utf8'))
const index = JSON.parse(readFileSync(path.join(os.homedir(), '.dsh/deepatlas/index.json'), 'utf8'))

const explainId = process.argv.includes('--explain') ? process.argv[process.argv.indexOf('--explain') + 1] : null

// Eligibility(与 find 工具同规则)
const eligible = index.plugins.filter((p) => {
  const kind = p.kind ?? classifyKind({ id: p.id, name: p.name, description: p.description, fork: p.fork })
  return !p.deadLink && !p.archived && isInstallable(kind)
})

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
function pool(task, n) {
  const tokens = tokenize(task.need)
  return eligible.map((p) => ({ p, s: prescore(p, tokens) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || (b.p.quality?.total ?? 0) - (a.p.quality?.total ?? 0))
    .slice(0, n)
}

const rows = []
let top1Hit = 0, top3Hit = 0, recall20 = 0, mustNotViolations = 0
const catStats = {}, failClass = { recall: 0, filter: 0, rank: 0 }
for (const task of golden.tasks) {
  const all = pool(task, 20)
  const ids20 = all.map(({ p }) => p.id)
  const top3 = ids20.slice(0, 3)
  const expected = [...task.expectedStrong, ...task.expectedAcceptable]
  const expectedStrong = task.expectedStrong
  const in20 = expected.some((id) => ids20.includes(id))
  const ok1 = ids20.length > 0 && expected.includes(ids20[0])
  const ok3 = top3.some((id) => expectedStrong.includes(id))
  const violated = top3.some((id) => task.mustNotRecommend.includes(id))
  if (in20) recall20++
  if (ok1) top1Hit++
  if (ok3) top3Hit++
  if (violated) mustNotViolations++

  // 失败三分类:目标(任一期望)未进 Top3 时
  let failure = null
  if (!ok3) {
    const inRaw = index.plugins.some((p) => expected.includes(p.id)) // 存在于索引
    if (!inRaw) failure = 'recall' // 索引里根本没有(数据层召回)
    else if (!in20) failure = 'filter' // 在索引但被资格/预筛过滤
    else failure = 'rank' // 进了 Top20 但排不进 Top3
    failClass[failure]++
  }
  const cat = task.category
  catStats[cat] = catStats[cat] ?? { n: 0, ok3: 0 }
  catStats[cat].n++
  if (ok3) catStats[cat].ok3++

  rows.push({ id: task.id, category: cat, need: task.need, top3, ids20, ok1, ok3, in20, violated, failure, expected })
}

// --explain 单案追踪
if (explainId) {
  const row = rows.find((r) => r.id === explainId)
  const task = golden.tasks.find((t) => t.id === explainId)
  if (!row) { console.error(`未找到任务 ${explainId}`); process.exit(1) }
  console.log(`=== Explain ${task.id} ===`)
  console.log(`任务: ${task.need}`)
  console.log(`期望强匹配: ${task.expectedStrong.join(', ') || '(无)'} / 可接受: ${task.expectedAcceptable.join(', ') || '(无)'}`)
  console.log(`Top3: ${row.top3.join(', ')}`)
  console.log(`Recall@20: ${row.in20 ? 'YES' : 'NO —— EXPECTED NOT RETRIEVED(先修召回/过滤,别碰排序)'}`)
  if (row.in20) {
    const pos = row.ids20.findIndex((id) => row.expected.includes(id))
    console.log(`期望插件在候选池位置: #${pos + 1}(需进 Top3 → 属排序问题)`)
  }
  console.log(`失败分类: ${row.failure ?? '未失败'}`)
  process.exit(0)
}

const metrics = {
  tasks: golden.tasks.length,
  candidateRecallAt20: +(recall20 / golden.tasks.length).toFixed(3),
  top1HitRate: +(top1Hit / golden.tasks.length).toFixed(3),
  top3StrongRate: +(top3Hit / golden.tasks.length).toFixed(3),
  mustNotAt3: mustNotViolations,
  failClass,
  byCategory: Object.fromEntries(Object.entries(catStats).map(([c, s]) => [c, `${s.ok3}/${s.n}`])),
  gate_P4: recall20 / golden.tasks.length >= 0.95 && top3Hit / golden.tasks.length >= 0.9 && mustNotViolations === 0 ? 'PASS' : 'FAIL',
}
writeFileSync(path.join(ROOT, 'benchmark/baseline.json'), JSON.stringify({ frozenAt: new Date().toISOString(), metrics, rows }, null, 2))
console.log('=== P3.8 Baseline v2(诊断版)===')
console.log(JSON.stringify(metrics, null, 2))
console.log('\n未命中案件(分类):')
for (const r of rows.filter((r) => !r.ok3)) {
  console.log(`  [${r.failure}] ${r.id} (${r.category}) ${r.need} → top3=[${r.top3.join(', ')}]`)
}
