/* eslint-env mocha */

import {
  DEFAULT_MAX_ALLOWED_HEADER_SIZE,
  DEFAULT_MAX_ALLOWED_SECTION_SIZE,
  resolveLimits
} from '../src/limits.js'
import { assert } from './common.js'

describe('resolveLimits', () => {
  it('applies both defaults when given undefined', () => {
    assert.deepStrictEqual(resolveLimits(), {
      maxAllowedHeaderSize: DEFAULT_MAX_ALLOWED_HEADER_SIZE,
      maxAllowedSectionSize: DEFAULT_MAX_ALLOWED_SECTION_SIZE
    })
  })

  it('applies both defaults when given an empty object', () => {
    assert.deepStrictEqual(resolveLimits({}), {
      maxAllowedHeaderSize: DEFAULT_MAX_ALLOWED_HEADER_SIZE,
      maxAllowedSectionSize: DEFAULT_MAX_ALLOWED_SECTION_SIZE
    })
  })

  it('overrides only the provided cap, defaults the other', () => {
    assert.deepStrictEqual(resolveLimits({ maxAllowedSectionSize: 1024 }), {
      maxAllowedHeaderSize: DEFAULT_MAX_ALLOWED_HEADER_SIZE,
      maxAllowedSectionSize: 1024
    })
  })

  it('accepts 0 as a real value (reject every section)', () => {
    assert.strictEqual(resolveLimits({ maxAllowedSectionSize: 0 }).maxAllowedSectionSize, 0)
  })

  it('accepts Number.MAX_SAFE_INTEGER as the opt-out', () => {
    assert.strictEqual(
      resolveLimits({ maxAllowedHeaderSize: Number.MAX_SAFE_INTEGER }).maxAllowedHeaderSize,
      Number.MAX_SAFE_INTEGER
    )
  })

  for (const bad of [-1, 1.5, NaN, Infinity, '8']) {
    it(`throws TypeError for ${String(bad)}`, () => {
      assert.throws(
        // @ts-expect-error deliberately bad input
        () => resolveLimits({ maxAllowedSectionSize: bad }),
        TypeError,
        'maxAllowedSectionSize must be a non-negative safe integer'
      )
    })
  }

  // The loop above only exercises the section-cap side of the validation; this
  // proves the same predicate is applied to the header cap too.
  it('throws TypeError for a negative maxAllowedHeaderSize', () => {
    assert.throws(
      () => resolveLimits({ maxAllowedHeaderSize: -1 }),
      TypeError,
      'maxAllowedHeaderSize must be a non-negative safe integer'
    )
  })
})
