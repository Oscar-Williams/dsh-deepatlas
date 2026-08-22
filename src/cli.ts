/**
 * 独立 CLI 入口(npm run scan / npm run status)
 * 不依赖 DSH 运行时,便于脚本化与 CI 中维护索引。
 *
 * scan [--incremental]  全量或增量重建索引(实时进度输出)
 * status                索引健康度 + Top10 质量分预览
 */
import { Scanner } from './core/scanner.js'
import { IndexStore, defaultDataDir } from './core/index-store.js'

const command = process.argv[2] ?? ''
const incremental = process.argv.includes('--incremental')
const ttlHours = Number(process.env.DEEPATLAS_TTL_HOURS ?? '24')
const store = new IndexStore(defaultDataDir(process.env.DEEPATLAS_DATA_DIR))
const scanner = new Scanner(store)

switch (command) {
  case 'scan': {
    const token = process.env.DEEPATLAS_GITHUB_TOKEN || undefined
    console.log(`[deepatlas] 开始${incremental ? '增量' : '全量'}扫描…`)
    const index = await scanner.scan({
      token,
      incremental,
      onProgress: (p) => console.log(`  [${p.sourceId}] ${p.message}`),
    })
    console.log(`[deepatlas] 索引完成:${index.plugins.length} 个插件 → ${store.location}`)
    for (const s of index.sources) {
      console.log(`  - ${s.sourceId}(${s.mode ?? 'full'}): ${s.ok ? `ok(${s.itemCount})` : `失败:${s.error}`}`)
    }
    break
  }
  case 'status': {
    const status = await scanner.status(ttlHours)
    if (!status.exists) {
      console.log(`[deepatlas] 尚无索引(${status.location}),请先运行 scan`)
      break
    }
    console.log(
      `[deepatlas] 索引:${status.pluginCount} 个插件,构建于 ${status.builtAt},${status.stale ? '已过期' : '有效'}`,
    )
    for (const s of status.sources ?? []) {
      console.log(`  - ${s.sourceId}(${s.mode ?? 'full'}): ${s.ok ? `ok(${s.itemCount})` : `失败:${s.error}`}`)
    }
    if (status.top10?.length) {
      console.log('\nTop10 质量分:')
      for (const [i, p] of status.top10.entries()) {
        console.log(`  ${String(i + 1).padStart(2)}. ${p.name}(${p.id}) ⭐${p.stars} 分${p.quality} [${p.type}]`)
      }
    }
    break
  }
  default:
    console.log('用法:deepatlas <scan [--incremental]|status>')
    process.exitCode = 1
}
