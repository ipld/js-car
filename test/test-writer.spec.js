/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { bytes, CID } from 'multiformats'
import * as raw from 'multiformats/codecs/raw'
import { createEncoder } from '../src/encoder.js'
import { create as iteratorChannel } from '../src/iterator-channel.js'
import { CarBlockIterator } from '../src/iterator.js'
import { DEFAULT_MAX_ALLOWED_SECTION_SIZE } from '../src/limits.js'
import { CarReader } from '../src/reader.js'
import { CarWriterOut } from '../src/writer-browser.js'
import { CarWriter } from '../src/writer.js'
import { carBytes, makeData, assert, rndCid, toBlock } from './common.js'
import {
  verifyRoots,
  verifyHas,
  verifyGet,
  verifyBlocks,
  verifyCids
} from './verify-store-reader.js'

/**
 * @typedef {import('../src/api.js').Block} Block
 */

const { toHex } = bytes

/**
 * @param {Uint8Array[]} chunks
 */
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

/**
 * @param {AsyncIterable<Uint8Array>} iterable
 */
function collector (iterable) {
  const chunks = []
  const cfn = (async () => {
    for await (const chunk of iterable) {
      chunks.push(chunk)
    }
    return concatBytes(chunks)
  })()
  return cfn
}

const newRoots = [
  CID.parse('bafkreidbxzk2ryxwwtqxem4l3xyyjvw35yu4tcct4cqeqxwo47zhxgxqwq'),
  CID.parse('bafkreiebzrnroamgos2adnbpgw5apo3z4iishhbdx77gldnbk57d4zdio4')
]

/**
 * @param {Uint8Array} bytes
 */
async function verifyUpdateRoots (bytes) {
  const reader = await CarReader.fromBytes(bytes)
  // the assert.isRejected form of this causes an uncatchable error in Chrome
  await expect(verifyRoots(reader)).to.eventually.be.rejected() // whoa, different roots? like magic
  assert.deepEqual(await reader.getRoots(), newRoots)
  await verifyHas(reader)
  await verifyGet(reader)
  await verifyBlocks(reader.blocks(), true)
  await verifyCids(reader.cids(), true)
}

describe('CarWriter', () => {
  /** @type {Block[]} */
  let cborBlocks
  /** @type {[string, Block[]][]} */
  let allBlocks
  /** @type {Block[]} */
  let allBlocksFlattened
  /** @type {CID[]} */
  let roots

  /**
   * @param {Uint8Array} actual
   */
  function assertCarData (actual) {
    assert.strictEqual(
      toHex(actual),
      toHex(carBytes),
      'got expected bytes'
    )
  }

  before(async () => {
    const data = await makeData()
    cborBlocks = data.cborBlocks
    allBlocks = data.allBlocks
    allBlocksFlattened = data.allBlocksFlattened
    roots = [cborBlocks[0].cid, cborBlocks[1].cid]
  })

  it('complete', async () => {
    const { writer, out } = CarWriter.create(roots)

    // writer is async iterable
    assert.strictEqual(typeof out[Symbol.asyncIterator], 'function')
    const collection = collector(out)

    const writeQueue = []
    for (const block of allBlocksFlattened) {
      writeQueue.push(writer.put(block))
    }
    writeQueue.push(writer.close())

    let collected = false
    collection.then((bytes) => {
      collected = true
      assertCarData(bytes)
    })
    await Promise.all(writeQueue)
    assert.strictEqual(collected, true)
  })

  it('complete, deferred collection', async () => {
    const { writer, out } = CarWriter.create(roots)

    const writeQueue = []
    for (const block of allBlocksFlattened) {
      writeQueue.push(writer.put(block))
    }
    writeQueue.push(writer.close())

    // attach to the iterator after we've queued all the writing
    let collected = false
    collector(out).then((bytes) => {
      collected = true
      assertCarData(bytes)
    })
    await Promise.all(writeQueue)
    assert.strictEqual(collected, true)
  })

  it('complete, close after write', async () => {
    const { writer, out } = CarWriter.create(roots)

    assert.strictEqual(typeof out[Symbol.asyncIterator], 'function')
    const collection = collector(out)

    const writeQueue = []
    for (const block of allBlocksFlattened) {
      writeQueue.push(writer.put(block))
    }
    writeQueue.push(writer.close())

    let written = false
    Promise.all(writeQueue).then(() => {
      written = true
    })
    const bytes = await collection
    assert.strictEqual(written, false)
    await Promise.resolve()
    assertCarData(bytes)
  })

  it('complete, no queue', async () => {
    const { writer, out } = CarWriter.create(roots)
    const collection = collector(out)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection
    assertCarData(bytes)
  })

  it('complete, slow drip', async () => {
    const { writer, out } = CarWriter.create(roots)

    // writer is async iterable
    assert.strictEqual(typeof out[Symbol.asyncIterator], 'function')
    const collection = collector(out)

    for (const block of allBlocksFlattened) {
      writer.put(block)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    await writer.close()

    await new Promise((resolve) => setTimeout(resolve, 100))

    const bytes = await collection
    assertCarData(bytes)
  })

  it('complete, no queue, deferred collection', async () => {
    const { writer, out } = CarWriter.create(roots)

    for (const block of allBlocksFlattened) {
      writer.put(block)
    }
    writer.close()

    const collection = collector(out)
    const bytes = await collection
    assertCarData(bytes)
  })

  it('single root', async () => {
    const { writer, out } = CarWriter.create(roots[0])
    const collection = collector(out)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection

    // test the start of the bytes to make sure we have the root def block we expect
    // { roots: [ CID(bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm) ], version: 1 }
    const expectedRootDef = 'a265726f6f747381d82a58250001711220f88bc853804cf294fe417e4fa83028689fcdb1b1592c5102e1474dbc200fab8b6776657273696f6e01'
    const expectedStart = (expectedRootDef.length / 2).toString(16) + // length of root def block
      expectedRootDef +
      '28' // length of first raw block + CIDv0

    assert.strictEqual(toHex(bytes).substring(0, expectedStart.length), expectedStart)
  })

  it('version', async () => {
    const { writer } = CarWriter.create(roots)

    // v1 only
    assert.equal(writer.version(), 1)
  })

  it('no roots', async () => {
    const { writer, out } = CarWriter.create()
    const collection = collector(out)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection

    // test the start of the bytes to make sure we have the root def block we expect
    // { roots: [], version: 1 }
    const expectedRootDef = 'a265726f6f7473806776657273696f6e01'
    const expectedStart = (expectedRootDef.length / 2).toString(16) + // length of root def block
      expectedRootDef +
      '28' // length of first raw block + CIDv0

    assert.strictEqual(toHex(bytes).substring(0, expectedStart.length), expectedStart)
  })

  it('appender', async () => {
    let writerOut = CarWriter.create(roots)
    let collection = collector(writerOut.out)
    await writerOut.writer.close()
    const headerBytes = await collection

    /** @param {number} index */
    const append = async (index) => {
      writerOut = CarWriter.createAppender()
      collection = collector(writerOut.out)
      for (const block of allBlocks[index][1]) {
        await writerOut.writer.put(block)
      }
      await writerOut.writer.close()
      return collection
    }

    const rawBytes = await append(0)
    const pbBytes = await append(1)
    const cborBytes = await append(2)

    assert.ok(rawBytes.length > 0)
    assert.ok(pbBytes.length > 0)
    assert.ok(cborBytes.length > 0)

    const reassembled = concatBytes([headerBytes, rawBytes, pbBytes, cborBytes])

    assert.strictEqual(toHex(reassembled), toHex(carBytes))
  })

  it('bad argument for create()', () => {
    for (const arg of [new Uint8Array(0), true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // @ts-expect-error arg is wrong type
      assert.throws(() => CarWriter.create(arg))
    }
  })

  it('bad argument for put()', async () => {
    const { writer } = CarWriter.create()
    for (const arg of [new Uint8Array(0), true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // the assert.isRejected form of this causes an uncatchable error in Chrome
      // @ts-expect-error
      await expect(writer.put(arg)).to.eventually.be.rejected()
    }

    for (const arg of [true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // the assert.isRejected form of this causes an uncatchable error in Chrome
      // @ts-expect-error
      await expect(writer.put({ bytes: new Uint8Array(0), cid: arg })).to.eventually.be.rejected()
    }

    for (const arg of [true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // the assert.isRejected form of this causes an uncatchable error in Chrome
      // @ts-expect-error
      await expect(writer.put({ cid: rndCid, bytes: arg })).to.eventually.be.rejected()
    }
  })

  it('bad write after closed', async () => {
    const { writer, out } = CarWriter.create()
    const collection = collector(out)
    await writer.put(allBlocksFlattened[0])
    await writer.close()
    await assert.isRejected(writer.put(allBlocksFlattened[1]), /closed/)
    await collection
  })

  it('errored write ends the out stream instead of hanging', async () => {
    const { writer, out } = CarWriter.create(roots)
    // force the write path to reject; the encoder is the writer's only route to
    // the out channel
    // @ts-expect-error _encoder is internal to CarWriter
    writer._encoder.writeBlock = () => Promise.reject(new Error('write failed'))
    const collection = collector(out)
    // the assert.isRejected form of this causes an uncatchable error in Chrome
    await expect(writer.put(allBlocksFlattened[0])).to.eventually.be.rejectedWith(/write failed/)
    // out must terminate (reject) rather than hang forever
    await expect(collection).to.eventually.be.rejectedWith(/write failed/)
    // a close() after the error rejects with the same error, not "closed"
    await expect(writer.close()).to.eventually.be.rejectedWith(/write failed/)
  })

  it('a write failure rejects the failed write and every write queued behind it', async () => {
    const { writer, out } = CarWriter.create(roots)
    const collection = collector(out)
    // @ts-expect-error _encoder is internal to CarWriter
    const encoder = writer._encoder
    const realWriteBlock = encoder.writeBlock.bind(encoder)
    let calls = 0
    // fail only the 2nd of three already-queued writes (the real production shape:
    // a check throwing partway through a streaming write)
    encoder.writeBlock = (/** @type {Block} */ block) => {
      calls += 1
      return calls === 2 ? Promise.reject(new Error('write failed')) : realWriteBlock(block)
    }
    const first = writer.put(allBlocksFlattened[0])
    const failing = writer.put(allBlocksFlattened[1])
    const queued = writer.put(allBlocksFlattened[2])
    await expect(first).to.eventually.be.fulfilled()
    await expect(failing).to.eventually.be.rejectedWith(/write failed/)
    await expect(queued).to.eventually.be.rejectedWith(/write failed/)
    await expect(collection).to.eventually.be.rejectedWith(/write failed/)
  })

  it('delivers already-written bytes before surfacing a later error', async () => {
    const { writer, out } = CarWriter.create(roots)
    const iterator = out[Symbol.asyncIterator]()
    // the constructor queues the header write; it must be delivered first
    const header = await iterator.next()
    assert.ok(!header.done && header.value.length > 0)
    // @ts-expect-error _encoder is internal to CarWriter
    writer._encoder.writeBlock = () => Promise.reject(new Error('write failed'))
    const putting = expect(writer.put(allBlocksFlattened[0])).to.eventually.be.rejectedWith(/write failed/)
    // the error surfaces on the next pull, it does not truncate silently
    await expect(iterator.next()).to.eventually.be.rejectedWith(/write failed/)
    await putting
  })

  it('a falsy write rejection still ends the out stream rather than hanging', async () => {
    const { writer, out } = CarWriter.create(roots)
    const collection = collector(out)
    // a rejection reason the channel must not gate behind a truthiness check
    // @ts-expect-error _encoder is internal to CarWriter
    writer._encoder.writeBlock = () => Promise.reject(undefined) // eslint-disable-line prefer-promise-reject-errors
    await expect(writer.put(allBlocksFlattened[0])).to.eventually.be.rejected()
    await expect(collection).to.eventually.be.rejected()
  })

  it('put()/close() after a fire-and-forget close() are rejected, not re-entered', async () => {
    const { writer, out } = CarWriter.create(roots)
    const collection = collector(out)
    const closing = writer.close() // fire-and-forget: not awaited before the next calls
    await expect(writer.put(allBlocksFlattened[0])).to.eventually.be.rejectedWith(/closed/i)
    await expect(writer.close()).to.eventually.be.rejectedWith(/closed/i)
    await closing
    await collection
  })

  it('a setRoots failure reaches the out stream', async () => {
    // setRoots runs in the constructor, so build the writer by hand to inject a
    // failing header write (the same seam createAppender uses)
    /** @type {import('../src/coding.js').IteratorChannel<Uint8Array>} */
    const iw = iteratorChannel()
    const encoder = createEncoder(iw.writer)
    encoder.setRoots = () => Promise.reject(new Error('setRoots failed'))
    const writer = new CarWriter([], encoder)
    const out = new CarWriterOut(iw.iterator)
    await expect(collector(out)).to.eventually.be.rejectedWith(/setRoots failed/)
    await expect(writer.close()).to.eventually.be.rejectedWith(/setRoots failed/)
  })

  it('a fire-and-forget put() that errors does not leave an unhandled rejection', async function () {
    // process.on('unhandledRejection') is a Node-only API (browsers surface it via
    // the unhandledrejection window event instead). Guard on process.versions.node,
    // not process.on: bundlers polyfill process.on as a no-op, which would let this
    // test pass vacuously in browser/webworker.
    if (typeof process === 'undefined' || process.versions?.node == null) {
      return this.skip()
    }
    const { writer, out } = CarWriter.create(roots)
    // @ts-expect-error _encoder is internal to CarWriter
    writer._encoder.writeBlock = () => Promise.reject(new Error('write failed'))
    /** @type {Error[]} */
    const unhandled = []
    /** @param {unknown} err */
    const onUnhandled = (err) => {
      if (err instanceof Error && /write failed/.test(err.message)) {
        unhandled.push(err)
      }
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const drained = expect(collector(out)).to.eventually.be.rejectedWith(/write failed/)
      // fire-and-forget, which the class docs bless; must not crash the process
      writer.put(allBlocksFlattened[0])
      await drained
      // let any pending unhandledRejection callback run
      await new Promise((resolve) => setTimeout(resolve, 10))
      assert.deepEqual(unhandled, [])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('bad attempt to multiple iterate', async () => {
    const { out } = CarWriter.create()
    collector(out)
    await assert.isRejected(collector(out), /multiple iterator/i)
  })

  it('bad attempt to multiple close', async () => {
    const { writer, out } = CarWriter.create()
    collector(out)
    await writer.close()

    // the assert.isRejected form of this causes an uncatchable error in Chrome
    await expect(writer.close()).to.eventually.be.rejectedWith(/closed/i)
  })

  it('update roots (fd)', async () => {
    const bytes = carBytes.slice()
    await CarWriter.updateRootsInBytes(bytes, newRoots)
    await verifyUpdateRoots(bytes)
  })

  it('update roots error: wrong header size', async () => {
    const bytes = carBytes.slice()
    await assert.isRejected(CarWriter.updateRootsInBytes(bytes, [...newRoots, newRoots[0]]), /can only overwrite a header of the same length/)
    await assert.isRejected(CarWriter.updateRootsInBytes(bytes, [newRoots[0]]), /can only overwrite a header of the same length/)
    await assert.isRejected(CarWriter.updateRootsInBytes(bytes, []), /can only overwrite a header of the same length/)
  })

  describe('encode()', () => {
    it('encodes the same bytes as create() from an array', async () => {
      assertCarData(await collector(CarWriter.encode(roots, allBlocksFlattened)))
    })

    it('encodes from an async iterable', async () => {
      async function * source () {
        yield * allBlocksFlattened
      }
      assertCarData(await collector(CarWriter.encode(roots, source())))
    })

    it('re-encodes a CarBlockIterator', async () => {
      const iterator = await CarBlockIterator.fromBytes(carBytes)
      assertCarData(await collector(CarWriter.encode(await iterator.getRoots(), iterator)))
    })

    it('accepts a single root or no roots', async () => {
      const single = await CarReader.fromBytes(await collector(CarWriter.encode(roots[0], allBlocksFlattened)))
      assert.deepEqual(await single.getRoots(), [roots[0]])
      const none = await CarReader.fromBytes(await collector(CarWriter.encode(undefined, [])))
      assert.deepEqual(await none.getRoots(), [])
    })

    it('pulls blocks only as the output is read', async () => {
      let pulled = 0
      async function * source () {
        for (const block of allBlocksFlattened) {
          pulled++
          yield block
        }
      }
      const iterator = CarWriter.encode(roots, source())[Symbol.asyncIterator]()
      assert.strictEqual(pulled, 0)
      await iterator.next() // header
      assert.strictEqual(pulled, 0)
      await iterator.next() // first section length
      assert.strictEqual(pulled, 1)
    })

    it('closes the source when the consumer stops early', async () => {
      let asyncClosed = false
      async function * source () {
        try {
          yield * allBlocksFlattened
        } finally {
          asyncClosed = true
        }
      }
      for await (const _ of CarWriter.encode(roots, source())) { // eslint-disable-line no-unused-vars
        // header
      }
      assert.strictEqual(asyncClosed, true, 'drained async source closes')

      asyncClosed = false
      let chunks = 0
      for await (const _ of CarWriter.encode(roots, source())) { // eslint-disable-line no-unused-vars
        if (++chunks === 3) { // inside the first section
          break
        }
      }
      assert.strictEqual(asyncClosed, true, 'async source closes on break')

      let syncClosed = false
      const iterable = {
        [Symbol.iterator] () {
          const it = allBlocksFlattened[Symbol.iterator]()
          return {
            next: () => it.next(),
            return: () => {
              syncClosed = true
              return /** @type {IteratorReturnResult<undefined>} */ ({ done: true, value: undefined })
            }
          }
        }
      }
      chunks = 0
      for await (const _ of CarWriter.encode(roots, iterable)) { // eslint-disable-line no-unused-vars
        if (++chunks === 3) {
          break
        }
      }
      assert.strictEqual(syncClosed, true, 'sync source closes on break')
    })

    it('encodes a zero-length block', async () => {
      const empty = await toBlock(new Uint8Array(0), raw)
      const reader = await CarReader.fromBytes(await collector(CarWriter.encode([empty.cid], [empty])))
      assert.strictEqual((await reader.get(empty.cid))?.bytes.length, 0)
    })

    it('can only be iterated once', async () => {
      const out = CarWriter.encode(roots, allBlocksFlattened)
      assertCarData(await collector(out))
      assert.throws(() => out[Symbol.asyncIterator](), /Multiple iterator not supported/)
    })

    it('throws an error from the source to the consumer', async () => {
      async function * source () {
        yield allBlocksFlattened[0]
        throw new Error('source failed')
      }
      await expect(collector(CarWriter.encode(roots, source()))).to.eventually.be.rejectedWith(/source failed/)
    })

    it('rejects an invalid block on iteration', async () => {
      // @ts-expect-error deliberately bad input
      const out = CarWriter.encode(roots, [{ cid: 'nope', bytes: new Uint8Array(1) }])
      await expect(collector(out)).to.eventually.be.rejectedWith(TypeError, /Can only write/)
      // @ts-expect-error deliberately bad input
      await expect(collector(CarWriter.encode(roots, [null]))).to.eventually.be.rejectedWith(TypeError, /Can only write/)
      // iterable, but not of blocks
      await expect(collector(CarWriter.encode(roots, /** @type {any} */ (carBytes)))).to.eventually.be.rejectedWith(TypeError, /Can only write/)
    })

    it('rejects a section over the size limit on iteration', async () => {
      const big = { cid: allBlocksFlattened[0].cid, bytes: new Uint8Array(DEFAULT_MAX_ALLOWED_SECTION_SIZE) }
      await expect(collector(CarWriter.encode(roots, [big]))).to.eventually.be.rejectedWith(RangeError, /maxAllowedSectionSize/)
      const bytes = await collector(CarWriter.encode(roots, [big], { maxAllowedSectionSize: Infinity }))
      const reader = await CarReader.fromBytes(bytes, { maxAllowedSectionSize: Infinity })
      assert.strictEqual((await reader.get(big.cid))?.bytes.length, big.bytes.length)
    })

    it('throws immediately for bad arguments and an over-cap header', () => {
      // @ts-expect-error deliberately bad input
      assert.throws(() => CarWriter.encode(roots, 100), TypeError, /Iterable or AsyncIterable/)
      // @ts-expect-error deliberately bad input
      assert.throws(() => CarWriter.encode(roots), TypeError, /Iterable or AsyncIterable/)
      // @ts-expect-error deliberately bad input
      assert.throws(() => CarWriter.encode('nope', []), TypeError, /roots/)
      assert.throws(() => CarWriter.encode(roots, [], { maxAllowedSectionSize: -1 }), RangeError)
      // @ts-expect-error deliberately bad input
      assert.throws(() => CarWriter.encode(roots, [], { maxAllowedSectionSize: '1' }), TypeError)
      assert.throws(() => CarWriter.encode(roots, [], { maxAllowedHeaderSize: 10 }), RangeError, /maxAllowedHeaderSize/)
    })
  })
})
