#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractCapabilityEvidence } from '../lib/core/capabilities.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = JSON.parse(readFileSync(path.join(root, 'benchmark/evidence-golden.json'), 'utf8'))
let truePositive = 0, falsePositive = 0, falseNegative = 0, mustNotFalseAccepts = 0
const failures = []
for (const test of fixture.cases) {
  const parts = test.parts.map((part, index) => ({
    ...part,
    provenance: {
      sourceId: `gold:${test.id}:${index}`,
      sourceKind: part.source === 'readme' ? 'github-contents' : 'manifest',
      authority: part.authority ?? 'publisher',
      repository: 'gold/fixture',
      ref: { kind: 'commit', value: 'a'.repeat(40) },
      path: part.source === 'readme' ? 'README.md' : 'package.json',
      contentSha256: String(index + 1).repeat(64).slice(0, 64),
      observedAt: '2026-08-24T00:00:00.000Z',
      originGroup: `${part.authority ?? 'publisher'}:gold:${test.id}:${index}`,
    },
  }))
  const accepted = new Set(extractCapabilityEvidence(parts).capabilities.filter((claim) => claim.decision === 'accepted').map((claim) => claim.id))
  const expected = new Set(test.accepted)
  for (const id of accepted) expected.has(id) ? truePositive++ : falsePositive++
  for (const id of expected) if (!accepted.has(id)) falseNegative++
  const violated = test.mustNot.filter((id) => accepted.has(id))
  mustNotFalseAccepts += violated.length
  if ([...accepted].sort().join() !== [...expected].sort().join() || violated.length) {
    failures.push({ id: test.id, expected: [...expected].sort(), accepted: [...accepted].sort(), violated })
  }
}
const acceptedPrecision = truePositive / Math.max(1, truePositive + falsePositive)
const acceptedRecall = truePositive / Math.max(1, truePositive + falseNegative)
const result = {
  version: fixture.version, cases: fixture.cases.length, truePositive, falsePositive, falseNegative,
  acceptedPrecision, acceptedRecall, mustNotFalseAccepts, failures,
  gate: acceptedPrecision >= fixture.thresholds.acceptedPrecision
    && acceptedRecall >= fixture.thresholds.acceptedRecall
    && mustNotFalseAccepts <= fixture.thresholds.mustNotFalseAccepts ? 'PASS' : 'FAIL',
}
console.log(JSON.stringify(result, null, 2))
if (result.gate !== 'PASS') process.exitCode = 1
