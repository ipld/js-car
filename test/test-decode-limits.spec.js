/* eslint-env mocha */

import { encode as cbEncode } from '@ipld/dag-cbor'
import { encode as vEncode } from 'varint'
import { CarBufferReader } from '../src/buffer-reader.js'
import { CarIndexer } from '../src/indexer.js'
import { CarBlockIterator, CarCIDIterator } from '../src/iterator.js'
import { DEFAULT_MAX_ALLOWED_SECTION_SIZE } from '../src/limits.js'
import { CarReader } from '../src/reader.js'
import { assert, carBytes, goCarV2Bytes, makeIterable, rndCid } from './common.js'

// Async entry points, each with a fromBytes and a fromIterable form. CarReader
// fully decodes during construction and exposes blocks() after; the other three
// decode lazily and yield via iteration.
const ENTRIES = [
  { name: 'CarBlockIterator', cls: CarBlockIterator },
  { name: 'CarCIDIterator', cls: CarCIDIterator },
  { name: 'CarReader', cls: CarReader },
  { name: 'CarIndexer', cls: CarIndexer }
]
const [blockIter] = ENTRIES

/** @param {{ name: string }} entry */
const isReader = (entry) => entry.name === 'CarReader'

/**
 * Drive a decode to completion (header + every block) and return the block
 * count. Rejects if decoding rejects at any point.
 *
 * @param {{ name: string, cls: any }} entry
 * @param {Uint8Array} data
 * @param {import('../src/api.js').CarCodecOptions} [options]
 * @param {'fromBytes'|'fromIterable'} [via]
 * @param {number} [chunkSize]
 */
async function decodeAll (entry, data, options, via = 'fromIterable', chunkSize = 64) {
  const input = via === 'fromBytes' ? data : makeIterable(data, chunkSize)
  const result = await entry.cls[via](input, options)
  const iterable = isReader(entry) ? result.blocks() : result
  let count = 0
  for await (const item of iterable) {
    if (item) {
      count++
    }
  }
  return count
}

/** @param {Uint8Array[]} chunks */
function concatBytes (chunks) {
  const length = chunks.reduce((p, c) => p + c.length, 0)
  const bytes = new Uint8Array(length)
  let off = 0
  for (const chunk of chunks) {
    bytes.set(chunk, off)
    off += chunk.length
  }
  return bytes
}

/** @param {Uint8Array} payload */
function lengthPrefixed (payload) {
  return concatBytes([Uint8Array.from(vEncode(payload.length)), payload])
}

const validV1Header = lengthPrefixed(cbEncode({ version: 1, roots: [] }))

describe('decode size limits', () => {
  describe('defaults are on with no options', () => {
    for (const via of /** @type {const} */(['fromBytes', 'fromIterable'])) {
      for (const entry of ENTRIES) {
        it(`${entry.name}.${via}: normal CAR decodes under the defaults`, async () => {
          const count = await decodeAll(entry, carBytes, undefined, via)
          assert.ok(count > 0)
        })
      }
    }

    it('v2 CAR decodes under the defaults', async () => {
      assert.ok(await decodeAll(blockIter, goCarV2Bytes, undefined) > 0)
    })
  })

  describe('rejects before buffering the body', () => {
    // A length prefix declaring a huge section, followed by only a CID and no
    // body. Under the default section cap the decoder must reject from the
    // prefix (RangeError), not stream-and-buffer and fail with
    // "Unexpected end of data".
    const huge = 1_000_000_000

    it('section over the default cap rejects with RangeError', async () => {
      const cid = rndCid.bytes
      const section = concatBytes([Uint8Array.from(vEncode(huge + cid.length)), cid])
      const data = concatBytes([validV1Header, section])
      await assert.isRejected(decodeAll(blockIter, data), RangeError, 'maxAllowedSectionSize')
    })

    it('lifting the cap to MAX_SAFE_INTEGER changes the failure to end-of-data', async () => {
      const cid = rndCid.bytes
      const section = concatBytes([Uint8Array.from(vEncode(huge + cid.length)), cid])
      const data = concatBytes([validV1Header, section])
      await assert.isRejected(
        decodeAll(blockIter, data, { maxAllowedSectionSize: Number.MAX_SAFE_INTEGER }),
        Error,
        'Unexpected end of data'
      )
    })
  })

  describe('section cap boundaries', () => {
    it('equal to the cap passes, cap+1 rejects', async () => {
      // largest section (cid + body) in carBytes, learned from an uncapped decode
      const iter = await CarBlockIterator.fromIterable(makeIterable(carBytes, 64))
      let maxSection = 0
      for await (const { cid, bytes } of iter) {
        maxSection = Math.max(maxSection, cid.bytes.length + bytes.length)
      }
      assert.ok(maxSection > 0)
      assert.ok(await decodeAll(blockIter, carBytes, { maxAllowedSectionSize: maxSection }) > 0)
      // one below the largest section: rejected
      await assert.isRejected(
        decodeAll(blockIter, carBytes, { maxAllowedSectionSize: maxSection - 1 }),
        RangeError,
        'maxAllowedSectionSize'
      )
    })

    it('0 rejects every section', async () => {
      await assert.isRejected(decodeAll(blockIter, carBytes, { maxAllowedSectionSize: 0 }), RangeError, 'maxAllowedSectionSize')
    })
  })

  describe('header cap', () => {
    it('rejects a v1 header over the cap', async () => {
      // carBytes' header is 99 bytes; cap well below
      await assert.isRejected(decodeAll(blockIter, carBytes, { maxAllowedHeaderSize: 10 }), RangeError, 'maxAllowedHeaderSize')
    })

    it('fires on the inner v1 header of a v2 CAR (recursion passes the cap)', async () => {
      // Set the cap to exactly the v2 pragma length: the pragma passes (equal),
      // the larger inner v1 header fails, proving the recursive readHeader gets
      // the same cap.
      const pragmaLen = cbEncode({ version: 2 }).length
      await assert.isRejected(decodeAll(blockIter, goCarV2Bytes, { maxAllowedHeaderSize: pragmaLen }), RangeError, 'maxAllowedHeaderSize')
    })
  })

  describe('CID bounded by its section', () => {
    it('rejects a CIDv1 declaring a multihash past the section end', async () => {
      // CIDv1 raw sha2-256 declaring a 1000-byte digest, inside a section only
      // large enough for the CID prefix. Section passes the section cap; the CID
      // does not fit the section.
      const cidPrefix = concatBytes([Uint8Array.from([0x01, 0x55, 0x12]), Uint8Array.from(vEncode(1000))])
      const section = concatBytes([Uint8Array.from(vEncode(cidPrefix.length + 1)), cidPrefix])
      const data = concatBytes([validV1Header, section])
      await assert.isRejected(decodeAll(blockIter, data), Error, 'exceeds section length')
    })

    it('rejects a sub-34-byte section opening with the CIDv0 prefix', async () => {
      // 0x12 0x20 triggers the CIDv0 branch; a 20-byte section cannot hold a
      // 34-byte CIDv0, so it must throw rather than read into the next section.
      const section = concatBytes([Uint8Array.from(vEncode(20)), Uint8Array.from([0x12, 0x20]), new Uint8Array(18)])
      const data = concatBytes([validV1Header, section])
      await assert.isRejected(decodeAll(blockIter, data), Error, 'exceeds section length')
    })
  })

  describe('digest cap (MAX_DIGEST_ALLOC)', () => {
    it('rejects a CIDv1 declaring a digest over 32 MiB, with the section cap lifted', async () => {
      const hugeDigest = (32 << 20) + 1
      const cidPrefix = concatBytes([Uint8Array.from([0x01, 0x55, 0x12]), Uint8Array.from(vEncode(hugeDigest))])
      const section = concatBytes([Uint8Array.from(vEncode(cidPrefix.length + 1)), cidPrefix])
      const data = concatBytes([validV1Header, section])
      // Section cap lifted so the section bound passes; the digest cap must fire
      // first (before any digest is read).
      await assert.isRejected(
        decodeAll(blockIter, data, { maxAllowedSectionSize: Number.MAX_SAFE_INTEGER }),
        RangeError,
        'CID digest'
      )
    })
  })

  describe('CarIndexer rejects from the prefix instead of stream-and-discarding', () => {
    it('rejects an oversized section without pulling its body', async () => {
      const cid = rndCid.bytes
      const section = concatBytes([Uint8Array.from(vEncode(1_000_000_000 + cid.length)), cid])
      const data = concatBytes([validV1Header, section])
      await assert.isRejected(decodeAll({ name: 'CarIndexer', cls: CarIndexer }, data), RangeError, 'maxAllowedSectionSize')
    })
  })

  describe('fromBytes threads an explicit cap through to every entry point', () => {
    // The other describe blocks above exercise explicit caps only through
    // decodeAll's default via ('fromIterable'), via CarBlockIterator. These
    // prove the fromBytes path (a separate code path in each entry point)
    // threads an explicit option through for CarReader and CarIndexer too.
    it('CarReader.fromBytes rejects a section over an explicit cap', async () => {
      await assert.isRejected(
        decodeAll({ name: 'CarReader', cls: CarReader }, carBytes, { maxAllowedSectionSize: 0 }, 'fromBytes'),
        RangeError,
        'maxAllowedSectionSize'
      )
    })

    it('CarIndexer.fromBytes rejects a section over an explicit cap', async () => {
      await assert.isRejected(
        decodeAll({ name: 'CarIndexer', cls: CarIndexer }, carBytes, { maxAllowedSectionSize: 0 }, 'fromBytes'),
        RangeError,
        'maxAllowedSectionSize'
      )
    })
  })

  describe('option validation', () => {
    for (const bad of [-1, 1.5, NaN, Infinity, '8']) {
      it(`rejects maxAllowedSectionSize=${String(bad)} with TypeError`, async () => {
        await assert.isRejected(
          // @ts-expect-error deliberately bad input
          decodeAll(blockIter, carBytes, { maxAllowedSectionSize: bad }),
          TypeError,
          'must be a non-negative safe integer'
        )
      })
    }
  })

  it('uses the documented default section size constant', () => {
    assert.strictEqual(DEFAULT_MAX_ALLOWED_SECTION_SIZE, 8 << 20)
  })

  describe('CarBufferReader (in-memory sync)', () => {
    /**
     * @param {Uint8Array} bytes
     * @param {import('../src/api.js').CarCodecOptions} [options]
     */
    const count = (bytes, options) => CarBufferReader.fromBytes(bytes, options).blocks().length

    it('decodes a normal CAR under the defaults', () => {
      assert.ok(count(carBytes) > 0)
    })

    it('rejects a section over the default cap', () => {
      const cid = rndCid.bytes
      const section = concatBytes([Uint8Array.from(vEncode(1_000_000_000 + cid.length)), cid])
      const data = concatBytes([validV1Header, section])
      assert.throws(() => count(data), RangeError, 'maxAllowedSectionSize')
    })

    it('rejects a header over an explicit cap', () => {
      assert.throws(() => count(carBytes, { maxAllowedHeaderSize: 10 }), RangeError, 'maxAllowedHeaderSize')
    })

    it('a section exactly at an explicit cap passes, cap+1 rejects', () => {
      const cid = rndCid.bytes
      const body = new Uint8Array(8)
      const cap = cid.length + body.length
      const section = concatBytes([Uint8Array.from(vEncode(cap)), cid, body])
      const data = concatBytes([validV1Header, section])
      assert.ok(count(data, { maxAllowedSectionSize: cap }) > 0)
      assert.throws(() => count(data, { maxAllowedSectionSize: cap - 1 }), RangeError, 'maxAllowedSectionSize')
    })

    it('rejects a bad option value with TypeError', () => {
      assert.throws(() => count(carBytes, { maxAllowedSectionSize: -1 }), TypeError, 'must be a non-negative safe integer')
    })
  })
})
