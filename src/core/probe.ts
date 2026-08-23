/**
 * InstallEnvironment 探针(P3.5-lite,采纳外部评审)
 *
 * 当前实现最小集:staging/工作目录的 workspace 吸收防护——
 * 若目录的任意祖先存在 pnpm-workspace.yaml 或 package.json(含 workspaces
 * 字段),pnpm 会把该目录当作已存在 workspace 的一部分,给出误导性的
 * "Already up to date"(Note 0009 踩坑)。装前主动检测并拒绝。
 * 完整 InstallEnvironment(platform/registry/probe/reachability)按
 * P3.5 后续增量补充,避免铺开。
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface ProbeResult {
  valid: boolean
  /** 无效原因(供 INSTALL_ENVIRONMENT_INVALID 展示) */
  reason?: string
  /** 命中的祖先 workspace 根 */
  workspaceRoot?: string
}

/** 从 dir 向上(不含 dir 自身可另议:含自身)查找 pnpm workspace 边界 */
export function detectWorkspaceAbsorption(dir: string, stopAt?: string): ProbeResult {
  let cur = path.resolve(dir)
  const stop = stopAt ? path.resolve(stopAt) : path.parse(cur).root
  for (;;) {
    const wsYml = path.join(cur, 'pnpm-workspace.yaml')
    if (existsSync(wsYml)) {
      return { valid: false, reason: `目录位于 pnpm workspace 内(${wsYml}),pnpm 会将其吸收为已有 workspace,安装将静默失效`, workspaceRoot: cur }
    }
    const pkgPath = path.join(cur, 'package.json')
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown }
        if (pkg.workspaces) {
          return { valid: false, reason: `目录位于 npm workspaces 项目内(${pkgPath}),包管理器会将其吸收,安装将静默失效`, workspaceRoot: cur }
        }
      } catch {
        /* 解析失败的 package.json 不视为 workspace 证据 */
      }
    }
    if (cur === stop || path.dirname(cur) === cur) return { valid: true }
    cur = path.dirname(cur)
    if (stopAt && !cur.toLowerCase().startsWith(stop.toLowerCase()) && cur.length <= stop.length) return { valid: true }
  }
}
