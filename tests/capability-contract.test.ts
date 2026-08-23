import { describe, expect, it } from 'vitest'
import { CAPABILITY_IDS, normalizeCapabilityIds } from '../src/core/capabilities.js'
import { DeepAtlasConfig } from '../src/config.js'
import { buildAdviseTool } from '../src/tools/advise.js'
import { buildFindTool } from '../src/tools/find.js'

const config: DeepAtlasConfig = {
  dataDir: '.',
  installProfile: 'web',
  indexTtlHours: 24,
  minStars: 0,
  githubTokenEnv: 'TEST_TOKEN',
  dryRun: true,
}

describe('capability 工具契约', () => {
  it('find 与 advise 共用数组 enum,且覆盖 Telegram 与 Web Search', () => {
    const find = buildFindTool({} as never, config)
    const advise = buildAdviseTool({} as never, config)
    const findSchema = find.parameters.capabilities
    const adviseSchema = advise.parameters.capabilities

    expect(findSchema).toEqual(adviseSchema)
    expect(findSchema.type).toBe('array')
    expect(findSchema.items.enum).toEqual(CAPABILITY_IDS)
    expect(findSchema.items.enum).toContain('messaging-telegram')
    expect(findSchema.items.enum).toContain('web-search')
  })

  it('规范化数组并兼容旧逗号字符串,忽略未知 ID', () => {
    expect(normalizeCapabilityIds(['web-search', 'unknown', 'web-search', ' messaging-telegram ']))
      .toEqual(['web-search', 'messaging-telegram'])
    expect(normalizeCapabilityIds('web-search, messaging-telegram'))
      .toEqual(['web-search', 'messaging-telegram'])
  })
})
