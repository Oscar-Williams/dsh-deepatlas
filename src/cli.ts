/**
 * 独立 CLI 入口(npm run scan / npm run status)
 * 不依赖 DSH 运行时,便于脚本化与 CI 中维护索引。
 */
import { Scanner } from './core/scanner.js'
import { IndexStore, defaultDataDir } from './core/index-store.js'

const command = process.argv[2] ?? ''
const ttlHours = Number(process.env.DEEPATLAS_TTL_HOURS ?? '24')
const store = new IndexStore(defaultDataDir(process.env.DEEPATLAS_DATA_DIR))
const scanner = new Scanner(store)

switch (command) {
  case 'scan': {
    const token = process.env.DEEPATLAS_GITHUB_TOKEN || undefined
    const index = await scanner.scan({ token })
    console.log(`[deepatlas] 索引完成:${index.plugins.length} 个插件 → ${store.location}`)
    for (const s of index.sources) {
      console.log(`  - ${s.sourceId}: ${s.ok ? `ok(${s.itemCount})` : `失败:${s.error}`}`)
    }
    break
  }
  case 'status': {
    const status = await scanner.status(ttlHours)
    if (!status.exists) {
      console.log(`[deepatlas] 尚无索引(${status.location}),请先运行 scan`)
      break
    }
    console.log(`[deepatlas] 索引:${status.pluginCount} 个插件,构建于 ${status.builtAt},${status.stale ? '已过期' : '有效'}`)
    for (const s of status.sources ?? []) {
      console.log(`  - ${s.sourceId}: ${s.ok ? `ok(${s.itemCount})` : `失败:${s.error}`}`)
    }
    break
  }
  default:
    console.log('用法:deepatlas <scan|status>')
    process.exitCode = 1
}
