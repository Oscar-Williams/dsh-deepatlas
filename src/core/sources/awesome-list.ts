/**
 * 数据源:awesome 清单(白名单与目录兜底)
 *
 * 解析 awesome 仓库 README 中 `- [name](url) — desc` 形态的条目,
 * 作为 GitHub topic 的补充与降级来源;同时维护白名单命中标记。
 */
import { EcosystemSource, RawPluginEntry } from './types.js'

/** 生态公认的白名单仓库(命中即 whitelisted=true) */
export const WHITELIST_REPOS = [
  'awesome-dsh-plugin/awesome-dsh-plugin',
  'like-study1/oh-my-dsh',
]

/** 当前纳入扫描与健康检查的社区清单源。 */
export const AWESOME_LISTS = [
  { sourceId: 'awesome-dsh-plugin', repo: 'awesome-dsh-plugin/awesome-dsh-plugin', ref: 'main', path: 'README.md' },
  { sourceId: 'awesome-dominic', repo: 'Dominic789654/awesome-deepseek-harness', ref: 'main', path: 'README.md' },
  { sourceId: 'awesome-0xsline', repo: '0xsline/awesome-deepseek-harness', ref: 'main', path: 'README.md' },
]

const ENTRY = /^\s*[-*]\s*\[([^\]]+)\]\((https:\/\/github\.com\/([^/\s)]+\/[^/\s)]+))\/?\)\s*[—–-]?\s*(.*)$/

export class AwesomeListSource implements EcosystemSource {
  readonly id = 'awesome-list'
  readonly label = 'awesome 清单(白名单/目录)'

  async *collect(token?: string, signal?: AbortSignal): AsyncGenerator<RawPluginEntry, void, unknown> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const failures: string[] = []
    for (const list of AWESOME_LISTS) {
      let body: string
      try {
        signal?.throwIfAborted()
        const file = list.path.split('/').map(encodeURIComponent).join('/')
        const url = `https://api.github.com/repos/${list.repo}/contents/${file}?ref=${encodeURIComponent(list.ref)}`
        const res = await fetch(url, { headers, signal })
        if (!res.ok) {
          failures.push(`${list.sourceId}:GitHub API ${res.status}`)
          continue
        }
        body = await res.text()
      } catch (error) {
        if (signal?.aborted) throw error
        failures.push(`${list.sourceId}:${error instanceof Error ? error.message : String(error)}`)
        continue
      }
      for (const line of body.split('\n')) {
        const m = ENTRY.exec(line)
        if (!m) continue
        const fullName = m[3].toLowerCase()
        yield {
          id: fullName,
          name: m[1],
          repoUrl: m[2],
          description: m[4].trim(),
          stars: 0, // awesome 条目缺 star 数,由 scanner 合并 GitHub 数据时补齐
          lastPushedAt: '',
          license: 'unknown',
          topics: [],
          provenance: {
            sourceId: list.sourceId, sourceKind: 'awesome-list', authority: 'community',
            repository: list.repo.toLowerCase(), ref: { kind: 'branch', value: list.ref }, path: list.path,
            observedAt: new Date().toISOString(), originGroup: `community:${list.repo.toLowerCase()}`,
          },
        }
      }
    }
    if (failures.length > 0) throw new Error(`awesome 清单读取不完整:${failures.join('; ')}`)
  }
}
