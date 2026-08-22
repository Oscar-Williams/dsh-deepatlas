/**
 * 数据源:GitHub topic `dsh-plugin`(生态事实上的发现入口)
 *
 * 通过 GitHub REST search API 分页抓取,遵守速率限制:
 * 未认证 10 次/分钟、认证 30 次/分钟;每页 100 条,页间退避。
 * TODO(P2): 失败重试与 awesome-list 兜底降级在 scanner 层编排。
 */
import { EcosystemSource, RawPluginEntry } from './types.js'

const API = 'https://api.github.com'
const TOPIC_QUERY = 'topic:dsh-plugin'

interface GhRepo {
  full_name: string
  name: string
  html_url: string
  description: string | null
  stargazers_count: number
  pushed_at: string
  license: { spdx_id: string } | null
  topics?: string[]
}

async function* fetchPage(token: string | undefined, page: number) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const url = `${API}/search/repositories?q=${encodeURIComponent(TOPIC_QUERY)}&sort=stars&order=desc&per_page=100&page=${page}`
  const res = await fetch(url, { headers })
  if (res.status === 403 || res.status === 429) {
    // 速率限制:读取 Retry-After,骨架阶段直接抛出让上层降级
    const retryAfter = Number(res.headers.get('retry-after') ?? '60')
    throw new Error(`GitHub API 速率限制,约 ${retryAfter}s 后重试`)
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  const json = (await res.json()) as { items: GhRepo[]; total_count: number }
  yield json.items
  return json.total_count
}

export class GitHubTopicSource implements EcosystemSource {
  readonly id = 'github-topic'
  readonly label = 'GitHub topic: dsh-plugin'

  async *collect(token?: string): AsyncGenerator<RawPluginEntry, void, unknown> {
    // 骨架阶段先取前 3 页(约 300 条);P1 扩展到全量分页 + 增量(since pushed_at)
    for (let page = 1; page <= 3; page++) {
      for await (const items of fetchPage(token, page)) {
        for (const repo of items) {
          yield {
            id: repo.full_name.toLowerCase(),
            name: repo.name,
            repoUrl: repo.html_url,
            description: repo.description ?? '',
            stars: repo.stargazers_count,
            lastPushedAt: repo.pushed_at,
            license: repo.license?.spdx_id ?? 'none',
            topics: repo.topics ?? [],
          }
        }
      }
    }
  }
}
