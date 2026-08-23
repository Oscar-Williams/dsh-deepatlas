import { describe, expect, it } from 'vitest'
import { asLosslessJson } from '../src/tools/common.js'

describe('DSH lossless JSON output boundary', () => {
  it('omits undefined object fields and materializes dense arrays', () => {
    const value = asLosslessJson({
      ok: true,
      optional: undefined,
      nested: { kept: 'yes', omitted: undefined },
      array: [1, undefined, 3],
    })

    expect(value).toEqual({
      ok: true,
      nested: { kept: 'yes' },
      array: [1, null, 3],
    })
    expect(JSON.parse(JSON.stringify(value))).toEqual(value)
  })

  it('rejects values that JSON cannot represent losslessly', () => {
    expect(() => asLosslessJson({ score: Number.NaN })).toThrow('non-finite')
    expect(() => asLosslessJson({ when: new Date() })).toThrow('non-plain')
  })
})
