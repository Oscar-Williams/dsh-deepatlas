/**
 * AuditReport v1(P3.5-C,采纳评审第六轮)
 *
 * 分节结构:provenance / package / sourceSignals / dependencyAudit /
 * compatibility / risk。措辞红线:源码扫描结论只称 risk signals,
 * 不称安全证明("Risk: Elevated — executes child processes")。
 *
 * v1 范围:package.json 清单层 + 至多 3 个关键文件(main 入口/
 * cordis.patch.yml)的正则信号;npm audit 子命令联动为 v1.1(当前
 * dependencyAudit 汇总清单层事实)。文件内容经 fetcher 注入以便测试。
 */
import { audit, AuditInput } from './auditor.js'
import { AuditReport } from '../types.js'

export interface SourceSignal {
  signal: string
  evidence: string
  level: 'info' | 'elevated'
}

const PATTERNS: { re: RegExp; signal: string; level: 'info' | 'elevated' }[] = [
  { re: /child_process|require\(['"]child_process|from ['"]node:child_process/, signal: 'child-process', level: 'elevated' },
  { re: /\beval\s*\(|new Function\s*\(/, signal: 'dynamic-eval', level: 'elevated' },
  { re: /fetch\s*\(|https?\.request|axios|node-fetch/, signal: 'network-access', level: 'info' },
  { re: /fs\.(writeFile|appendFile|rm|unlink)|writeFileSync/, signal: 'filesystem-write', level: 'info' },
  { re: /\bkoffi\b|node-ffi|\.node['"]/, signal: 'native-binary', level: 'elevated' },
  { re: /process\.env\.[A-Z_]*(TOKEN|KEY|SECRET)/, signal: 'credential-read', level: 'info' },
]

export function scanSourceSignals(files: Record<string, string>): SourceSignal[] {
  const out: SourceSignal[] = []
  for (const [name, content] of Object.entries(files)) {
    for (const p of PATTERNS) {
      if (p.re.test(content)) out.push({ signal: p.signal, evidence: `${name} 命中 ${p.signal}`, level: p.level })
    }
  }
  return out
}

export interface AuditReportV1 extends AuditReport {
  provenance: { repository: string; commitPinned: boolean; archived?: boolean; dead?: boolean }
  package_: {
    installScripts: string[]
    nativeDependencies: string[]
    dependencyCount: number
  }
  sourceSignals: SourceSignal[]
  dependencyAudit: {
    /** v1:清单层汇总;v1.1 接 npm audit 子命令 */
    opaqueDependencies: string[]
    note: string
  }
  risk: { level: 'green' | 'yellow' | 'red' | 'elevated'; reasons: string[] }
}

export function buildAuditReportV1(
  input: AuditInput,
  files: Record<string, string> = {},
): AuditReportV1 {
  const base = audit(input)
  const manifest = (input.manifest ?? {}) as Record<string, unknown>
  const deps = {
    ...((manifest.dependencies ?? {}) as Record<string, string>),
    ...((manifest.devDependencies ?? {}) as Record<string, string>),
  }
  const signals = scanSourceSignals(files)
  const opaque = Object.entries(deps)
    .filter(([, v]) => typeof v === 'string' && /^(git\+|git:|http:|https:|file:)/.test(v))
    .map(([k]) => k)

  const reasons: string[] = base.findings.map((f) => `${f.rule}:${f.evidence}`)
  const elevated = signals.filter((s) => s.level === 'elevated')
  if (elevated.length) {
    reasons.push(`Risk: Elevated — ${elevated.map((s) => s.signal).join(', ')}(risk signals,非安全判定)`)
  }

  const riskLevel: AuditReportV1['risk']['level'] =
    base.level === 'red' ? 'red' : elevated.length ? 'elevated' : base.level

  return {
    ...base,
    provenance: { repository: input.target, commitPinned: input.commitPinned },
    package_: {
      installScripts: base.findings.filter((f) => f.rule === 'lifecycle-scripts').map((f) => f.evidence),
      nativeDependencies: Object.keys(deps).filter((d) => ['koffi', 'node-pty', 'protobufjs', 'sharp', 'better-sqlite3', 'node-gyp-build'].includes(d)),
      dependencyCount: Object.keys(deps).length,
    },
    sourceSignals: signals,
    dependencyAudit: {
      opaqueDependencies: opaque,
      note: 'v1 为清单层汇总;npm audit 子命令联动在 v1.1(需目标仓库 lockfile)',
    },
    risk: { level: riskLevel, reasons },
  }
}
