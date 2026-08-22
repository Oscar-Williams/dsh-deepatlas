/**
 * 数据源:GitHub topic `dsh-plugin`(生态事实上的发现入口)
 *
 * P1 能力:
 * - 全量分页:遍历 search API 所有页(约 7800+ 仓库),页空或达 total 即止;
 * - 增量模式:仅抓 pushed:>since 之后有更新的仓库;
 * - 速率限制:403/429 读取 Retry-After 指数退避,有限重试后抛错由上层降级;
 * - 进度回调:onProgress({ page, fetched, total }) 供 CLI 实时输出。
 */
import { EcosystemSource, RawPluginEntry } from './types.js'

const API = 'https://api.github.com'
const TOPIC_QUERY = 'topic:dsh-plugin'
const PER_PAGE = 100
const MAX_PAGES = 100 // 10000 条上限(API 硬限),超出需按时间窗分段(P2 优化)
const MAX_RETRY = 3

export interface TopicProgress {
  page: number
  fetched: number
  total: number
}

export interface TopicCollectOptions {
  token?: string
  /** 增量:仅抓该时间(ISO 8601)之后有推送的仓库 */
  since?: string
  onProgress?: (p: TopicProgress) => void
}

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(url: string, headers: Record<string, string>): Promise<{ items: GhRepo[]; total: number }> {
  let retry = 0
  // 速率限制退避:403/429 时按 Retry-After 或 2^n 秒等待,有限重试后放弃
  for (;;) {
    const res = await fetch(url, { headers })
    if (res.ok) {
      const json = (await res.json()) as { items: GhRepo[]; total_count: number }
      return { items: json.items, total: json.total_count }
    }
    if ((res.status === 403 || res.status === 429) && retry < MAX_RETRY) {
      const wait = Number(res.headers.get('retry-after') ?? '0') * 1000 || 2 ** retry * 1000
      await sleep(Math.min(wait, 30_000))
      retry++
      continue
    }
    throw new Error(`GitHub API ${res.status}(重试 ${retry} 次后放弃)`)
  }
}

export class GitHubTopicSource implements EcosystemSource {
  readonly id = 'github-topic'
  readonly label = 'GitHub topic: dsh-plugin'

  constructor(private readonly options: TopicCollectOptions = {}) {}

  async *collect(): AsyncGenerator<RawPluginEntry, void, unknown> {
    const { token, since, onProgress } = this.options
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (token) headers.Authorization = `Bearer ${token}`

    // 增量用 pushed: 过滤器;全量只按 topic
    const q = since ? `${TOPIC_QUERY} pushed:>${since}` : TOPIC_QUERY
    let fetched = 0

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_PAGE}&page=${page}`
      const { items, total } = await fetchPage(url, headers)
      if (items.length === 0) break

      for (const repo of items) {
        fetched++
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
      onProgress?.({ page, fetched, total })
      if (fetched >= total) break // 最后一页收尾
    }
  }
}
