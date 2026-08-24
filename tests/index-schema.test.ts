import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../src/core/index-store.js'

const readJson = (url: URL): unknown => JSON.parse(readFileSync(fileURLToPath(url), 'utf8'))

describe('公开索引 Schema', () => {
  const schema = readJson(new URL('../data/index.schema.json', import.meta.url)) as Record<string, unknown>
  const fixture = readJson(new URL('./fixtures/evidence-v2/index.json', import.meta.url))

  it('与运行时 schemaVersion 同步，并接受冻结的原生 Evidence v2 索引', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    addFormats(ajv)
    const validate = ajv.compile(schema)
    expect((schema.properties as { schemaVersion: { const: number } }).schemaVersion.const).toBe(SCHEMA_VERSION)
    expect(validate(fixture), JSON.stringify(validate.errors, null, 2)).toBe(true)
  })

  it('拒绝缺少 Evidence v2 契约字段的旧式记录', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true })
    addFormats(ajv)
    const validate = ajv.compile(schema)
    const invalid = structuredClone(fixture) as { plugins: Array<Record<string, unknown>> }
    delete invalid.plugins[0].evidence
    expect(validate(invalid)).toBe(false)
  })
})
