/**
 * 工具:deepatlas_audit(M4)
 * 抓取目标仓库 package.json 快照,执行装前安全审计,返回分级报告。
 */
import { Context } from '@deepseek-ai/cordis'
import { DeepAtlasConfig } from '../config.js'
import { WHITELIST_REPOS } from '../core/sources/awesome-list.js'
import { asLosslessJson, looseObjectOutput, renderJson, type ToolExecutionContext } from './common.js'
import { buildPluginRecord, toRequirement } from '../core/record.js'
import { checkCompatibility, getRuntimeInfo } from '../core/compat.js'
import { buildAuditReportV1 } from '../core/audit-v1.js'
import { AuditCache } from '../core/audit-cache.js'
import { defaultDataDir } from '../core/index-store.js'
import { isFullCommitSha, isGithubRepoSlug } from '../core/git-ref.js'
import { resolveGithubToken } from '../core/github.js'
import { declaredSourceFiles, fetchArtifactAtCommit, resolveCommit } from '../core/github-artifacts.js'

async function fetchRepositoryFile(
  target: string,
  file: string,
  commit: string | undefined,
  token: string | undefined,
  signal?: AbortSignal,
): Promise<{ text: string | null; error?: string }> {
  if (!commit) return { text: null, error: `${file} 获取失败:未固定 commit` }
  const fetched = await fetchArtifactAtCommit(target, file, commit, token, signal)
  return { text: fetched.artifact?.text ?? null, error: fetched.error }
}

async function fetchManifest(
  target: string,
  commit: string | undefined,
  token: string | undefined,
  signal?: AbortSignal,
): Promise<{ manifest: Record<string, unknown> | null; error?: string }> {
  const fetched = await fetchRepositoryFile(target, 'package.json', commit, token, signal)
  if (!fetched.text) return { manifest: null, error: fetched.error }
  try {
    return { manifest: JSON.parse(fetched.text) as Record<string, unknown> }
  } catch (error) {
    return { manifest: null, error: `package.json 解析失败:${error instanceof Error ? error.message : String(error)}` }
  }
}

export function buildAuditTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_audit',
    description:
      '对目标插件执行装前安全审计(生命周期脚本/依赖形态/协议/commit 锁定/白名单),返回绿黄红分级与逐条证据。安装前必须执行。',
    parameters: {
      target: { type: 'string' as const, required: true, description: '目标仓库,格式 owner/repo' },
      commit: { type: 'string' as const, description: '锁定的完整 40 位 commit SHA;不传则只审计漂移的 HEAD' },
    },
    output: { schema: looseObjectOutput, render: renderJson },
    async execute(args: { target: string; commit?: string }, execution?: ToolExecutionContext) {
      execution?.signal?.throwIfAborted()
      const target = args.target.trim().toLowerCase().replace(/^github:/, '')

      if (!isGithubRepoSlug(target)) {
        return asLosslessJson({ ok: false, level: 'red', action: '审计拒绝:target 必须严格使用 owner/repo 格式' })
      }

      if (args.commit && !isFullCommitSha(args.commit)) {
        return asLosslessJson({
          ok: false,
          level: 'red',
          auditedRef: args.commit,
          action: '审计拒绝:commit 必须是完整 40 位十六进制 SHA,不能使用分支、tag、HEAD 或短哈希',
        })
      }

      // ⑤ 内容寻址缓存:同 repo+commit+版本 直接复用
      const cache = new AuditCache(defaultDataDir(config.dataDir))
      if (args.commit) {
        const cached = await cache.get(target, args.commit)
        if (cached) return asLosslessJson({ ...cached, action: '(来自审计缓存,同 commit 复用)' })
      }

      const token = resolveGithubToken(config)
      let contentCommit: string
      try {
        contentCommit = args.commit ?? await resolveCommit(target, 'HEAD', token, execution?.signal)
      } catch (error) {
        return asLosslessJson({
          ok: false, level: 'red', auditedRef: args.commit ?? 'HEAD',
          action: `审计失败并拒绝进入安装:${error instanceof Error ? error.message : String(error)}`,
        })
      }
      const fetched = await fetchManifest(target, contentCommit, token, execution?.signal)
      if (!fetched.manifest) {
        return asLosslessJson({
          ok: false,
          level: 'red',
          auditedRef: args.commit ?? 'HEAD',
          action: `审计失败并拒绝进入安装:${fetched.error ?? 'package.json 不可用'}`,
        })
      }
      const manifest = fetched.manifest
      // 源码信号覆盖 manifest 实际声明的入口与 bundle patch。声明文件
      // 无法读取时 fail-closed，避免把缺失证据写成可安装授权缓存。
      const files: Record<string, string> = {}
      const declared = declaredSourceFiles(manifest)
      if (declared.error) {
        return asLosslessJson({
          ok: false,
          level: 'red',
          auditedRef: args.commit ?? 'HEAD',
          sourceCoverage: { required: declared.files, fetched: [] },
          action: `审计失败并拒绝进入安装:${declared.error}`,
        })
      }
      for (const f of declared.files) {
        const result = await fetchRepositoryFile(target, f, contentCommit, token, execution?.signal)
        if (result.text === null) {
          return asLosslessJson({
            ok: false,
            level: 'red',
            auditedRef: args.commit ?? 'HEAD',
            sourceCoverage: { required: declared.files, fetched: Object.keys(files) },
            action: `审计失败并拒绝进入安装:${result.error ?? `${f} 不可用`}`,
          })
        }
        files[f] = result.text
      }
      const report = buildAuditReportV1(
        { target, manifest, commitPinned: Boolean(args.commit), whitelisted: WHITELIST_REPOS.includes(target) },
        files,
      )

      // 兼容性闸门:PluginRecord + 当前运行时对照
      const record = buildPluginRecord(target, manifest)
      const compatibility = checkCompatibility(toRequirement(record), getRuntimeInfo())
      const payload = {
        ok: true,
        ...report,
        auditedRef: args.commit ?? 'HEAD',
        pluginRecord: record,
        compatibility,
        sourceCoverage: { required: declared.files, fetched: Object.keys(files) },
      }

      execution?.signal?.throwIfAborted()
      if (args.commit) await cache.put(target, args.commit, payload)

      if (report.risk.level === 'red') {
        return asLosslessJson({ ...payload, action: '红色风险:拒绝自动安装,请人工审查源码后手动处理' })
      }
      if (!args.commit) {
        return asLosslessJson({ ...payload, action: '注意:本次审计基于 HEAD(漂移对象)。安装前必须锁定 commit 并重新审计,审计对象与安装对象必须一致(TOCTOU 防护)' })
      }
      return asLosslessJson({
        ...payload,
        action:
          report.risk.level === 'elevated'
            ? 'Elevated(源码信号):可继续,但请阅读信号清单——是风险提示而非安全判定'
            : report.level === 'yellow'
              ? '黄色风险:可在用户二次确认后继续安装流程'
              : '绿色:可进入用户确认与安装流程',
      })
    },
  }
}
