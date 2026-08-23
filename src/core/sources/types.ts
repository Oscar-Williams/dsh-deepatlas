/**
 * 数据源统一接口:所有生态扫描来源(GitHub topic、awesome 清单、商店)
 * 都实现该接口,扫描器按序抓取并在仓库维度去重。
 */
export interface RawPluginEntry {
  /** "owner/repo" */
  id: string
  name: string
  repoUrl: string
  description: string
  stars: number
  /** ISO 8601,未知则留空,由扫描器标记 unknown */
  lastPushedAt: string
  license: string
  topics: string[]
  provides?: string[]
}

export interface EcosystemSource {
  /** 数据源标识,如 "github-topic" */
  readonly id: string
  /** 中文说明 */
  readonly label: string
  /** 抓取并归一化为原始条目;实现内部处理分页与速率限制 */
  collect(token?: string, signal?: AbortSignal): AsyncGenerator<RawPluginEntry, void, unknown>
}
