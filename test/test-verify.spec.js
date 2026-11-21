/* eslint-env mocha */

import { bytes, CID } from 'multiformats'
import * as raw from 'multiformats/codecs/raw'
import * as Digest from 'multiformats/hashes/digest'
import { from as hasher } from 'multiformats/hashes/hasher'
import { identity } from 'multiformats/hashes/identity'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { CarBufferReader } from '../src/buffer-reader-browser.js'
import { CarBlockIterator, CarCIDIterator } from '../src/iterator.js'
import { CarReader } from '../src/reader-browser.js'
import { verifyBlock, InvalidMultihashError, UnknownHashAlgorithmError } from '../src/verify.js'
import { CarWriter } from '../src/writer-browser.js'
import { assert, carBytes, goCarV2Bytes } from './common.js'

/**
 * @typedef {import('../src/api.js').Block} Block
 * @typedef {import('../src/api.js').CarDecodeOptions} CarDecodeOptions
 */

// the 'aaaa' raw block, changed to 'aaab'
const tamperedCarBytes = bytes.fromHex(bytes.toHex(carBytes).replace('61616161', '61616162'))

const asyncSha256 = hasher({
  name: 'sha2-256',
  code: sha256.code,
  encode: async (input) => (await sha256.digest(input)).digest
})

/**
 * @param {Uint8Array} data
 */
async function * chunked (data) {
  for (let i = 0; i < data.length; i += 7) {
    yield data.subarray(i, i + 7)
  }
}

/**
 * @param {AsyncIterable<Uint8Array>} iterable
 */
async function collect (iterable) {
  /** @type {Uint8Array[]} */
  const chunks = []
  for await (const chunk of iterable) {
    chunks.push(chunk)
  }
  const out = new Uint8Array(chunks.reduce((p, c) => p + c.length, 0))
  let off = 0
  for (const chunk of chunks) {
    out.set(chunk, off)
    off += chunk.length
  }
  return out
}

/**
 * @param {import('multiformats/hashes/interface').MultihashHasher} h
 * @param {Uint8Array} data
 * @returns {Promise<Block>}
 */
async function makeBlock (h, data) {
  return { cid: CID.createV1(raw.code, await h.digest(data)), bytes: data }
}

/**
 * Every async reader path, fully consumed.
 *
 * @type {Record<string, (data: Uint8Array, options?: CarDecodeOptions) => Promise<unknown>>}
 */
const asyncReaders = {
  'CarReader.fromBytes': (data, options) => CarReader.fromBytes(data, options),
  'CarReader.fromIterable': (data, options) => CarReader.fromIterable(chunked(data), options),
  'CarBlockIterator.fromBytes': async (data, options) => {
    for await (const _ of await CarBlockIterator.fromBytes(data, options)) {} // eslint-disable-line no-unused-vars, no-empty
  },
  'CarBlockIterator.fromIterable': async (data, options) => {
    for await (const _ of await CarBlockIterator.fromIterable(chunked(data), options)) {} // eslint-disable-line no-unused-vars, no-empty
  },
  'CarCIDIterator.fromBytes': async (data, options) => {
    for await (const _ of await CarCIDIterator.fromBytes(data, options)) {} // eslint-disable-line no-unused-vars, no-empty
  },
  'CarCIDIterator.fromIterable': async (data, options) => {
    for await (const _ of await CarCIDIterator.fromIterable(chunked(data), options)) {} // eslint-disable-line no-unused-vars, no-empty
  }
}

describe('verifyBlock()', () => {
  const data = new TextEncoder().encode('verify me')

  it('accepts a matching sha2-256 block', async () => {
    await verifyBlock(await makeBlock(sha256, data))
  })

  it('rejects bytes that do not match', async () => {
    const block = await makeBlock(sha256, data)
    await assert.isRejected((async () => verifyBlock({ cid: block.cid, bytes: data.subarray(1) }))(), InvalidMultihashError, 'do not match')
  })

  it('verifies identity CIDs exactly', async () => {
    const block = await makeBlock(identity, data)
    await verifyBlock(block)
    const longer = new Uint8Array([...data, 0])
    assert.throws(() => verifyBlock({ cid: block.cid, bytes: longer }), InvalidMultihashError)
  })

  it('needs a hasher for other multihashes', async () => {
    const block = await makeBlock(sha512, data)
    assert.throws(() => verifyBlock(block), UnknownHashAlgorithmError, /0x13/)
    await verifyBlock(block, { hashers: [sha512] })
    await assert.isRejected((async () => verifyBlock({ cid: block.cid, bytes: data.subarray(1) }, { hashers: [sha512] }))(), InvalidMultihashError)
  })

  it('supports truncated digests', async () => {
    const full = (await sha256.digest(data)).digest
    await verifyBlock({ cid: CID.createV1(raw.code, Digest.create(sha256.code, full.subarray(0, 20))), bytes: data })
    // below the hasher's 20-byte minimum
    const short = { cid: CID.createV1(raw.code, Digest.create(sha256.code, full.subarray(0, 8))), bytes: data }
    await assert.isRejected((async () => verifyBlock(short))(), InvalidMultihashError, 'Unable to verify')
  })

  it('rejects a digest longer than the hasher produces', async () => {
    const full = (await sha256.digest(data)).digest
    const cid = CID.createV1(raw.code, Digest.create(sha256.code, new Uint8Array([...full, ...full.subarray(0, 8)])))
    for (const hashers of [[sha256], [asyncSha256]]) {
      await assert.isRejected((async () => verifyBlock({ cid, bytes: data }, { hashers }))(), InvalidMultihashError)
    }
  })

  it('rejects a zero-length digest', async () => {
    const block = { cid: CID.createV1(raw.code, Digest.create(sha256.code, new Uint8Array(0))), bytes: data }
    await assert.isRejected((async () => verifyBlock(block))(), InvalidMultihashError)
  })

  it('wraps a failing async hasher', async () => {
    const failing = hasher({ name: 'sha2-256', code: sha256.code, encode: async () => { throw new Error('boom') } })
    const block = await makeBlock(sha256, data)
    await assert.isRejected(Promise.resolve(verifyBlock(block, { hashers: [failing] })), InvalidMultihashError, 'boom')
  })

  it('accepts a hasher with a short natural digest', async () => {
    // 16 bytes, below the default 20-byte truncation minimum
    const short = hasher({ name: 'short', code: 0x300001, encode: async (input) => (await sha256.digest(input)).digest.subarray(0, 16) })
    await verifyBlock(await makeBlock(short, data), { hashers: [short] })
  })

  it('lets hashers replace the built-in sha2-256', async () => {
    let calls = 0
    const counting = hasher({
      name: 'sha2-256',
      code: sha256.code,
      encode: async (input) => {
        calls++
        return (await sha256.digest(input)).digest
      }
    })
    await verifyBlock(await makeBlock(sha256, data), { hashers: [counting] })
    assert.strictEqual(calls, 1)
  })

  it('returns a Promise only for an async hasher', async () => {
    const block = await makeBlock(sha256, data)
    assert.strictEqual(verifyBlock(block, { hashers: [sha256] }) instanceof Promise, sha256.digest(data) instanceof Promise)
    const result = verifyBlock(block, { hashers: [asyncSha256] })
    assert.instanceOf(result, Promise)
    await result
  })

  it('rejects invalid hashers', async () => {
    const block = await makeBlock(sha256, data)
    // @ts-expect-error deliberately bad input
    assert.throws(() => verifyBlock(block, { hashers: sha512 }), TypeError, /hashers/)
    // @ts-expect-error deliberately bad input
    assert.throws(() => verifyBlock(block, { hashers: [{ code: 1 }] }), TypeError, /hashers/)
  })
})

describe('Block verification in readers', () => {
  for (const [name, read] of Object.entries(asyncReaders)) {
    describe(name, () => {
      it('is off by default', async () => {
        await read(tamperedCarBytes)
      })

      it('accepts valid CARv1 and CARv2', async () => {
        await read(carBytes, { verify: true })
        await read(goCarV2Bytes, { verify: true })
      })

      it('rejects a tampered block', async () => {
        await assert.isRejected(read(tamperedCarBytes, { verify: true }), InvalidMultihashError)
      })

      it('works with an async hasher', async () => {
        await read(carBytes, { verify: true, hashers: [asyncSha256] })
        await assert.isRejected(read(tamperedCarBytes, { verify: true, hashers: [asyncSha256] }), InvalidMultihashError)
      })

      it('rejects an unknown multihash', async () => {
        const block = await makeBlock(sha512, new Uint8Array([1, 2, 3]))
        const car = await collect(CarWriter.encode([block.cid], [block]))
        await assert.isRejected(read(car, { verify: true }), UnknownHashAlgorithmError)
        await read(car, { verify: true, hashers: [sha512] })
      })

      it('rejects invalid options', async () => {
        // @ts-expect-error deliberately bad input
        await assert.isRejected(read(carBytes, { verify: 'yes' }), TypeError, /verify/)
        // @ts-expect-error deliberately bad input
        await assert.isRejected(read(carBytes, { verify: true, hashers: {} }), TypeError, /hashers/)
        // @ts-expect-error deliberately bad input
        await assert.isRejected(read(carBytes, { hashers: {} }), TypeError, /hashers/)
      })
    })
  }

  describe('CarBufferReader.fromBytes', () => {
    // sha2-256 is synchronous in Node.js, asynchronous in browsers
    const syncSha256 = !(sha256.digest(new Uint8Array()) instanceof Promise)

    it('is off by default', () => {
      CarBufferReader.fromBytes(tamperedCarBytes)
    })

    it('verifies with the built-in sha2-256 where it is synchronous', () => {
      if (!syncSha256) {
        assert.throws(() => CarBufferReader.fromBytes(carBytes, { verify: true }), TypeError, /asynchronous/)
        return
      }
      CarBufferReader.fromBytes(carBytes, { verify: true })
      CarBufferReader.fromBytes(goCarV2Bytes, { verify: true })
      assert.throws(() => CarBufferReader.fromBytes(tamperedCarBytes, { verify: true }), InvalidMultihashError)
    })

    it('rejects an async hasher', () => {
      assert.throws(() => CarBufferReader.fromBytes(carBytes, { verify: true, hashers: [asyncSha256] }), TypeError, /asynchronous/)
    })
  })
})
