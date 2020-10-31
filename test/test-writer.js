/* eslint-env mocha */
/* globals describe, it */

import { create } from '@ipld/car/writer'
import { bytes } from 'multiformats'
import { carBytes, makeData, assert, rndCid } from './common.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 */

const { toHex } = bytes

/**
 * @param {AsyncIterable<Uint8Array>} iterable
 */
function collector (iterable) {
  return (async () => {
    const chunks = []
    let length = 0
    for await (const chunk of iterable) {
      chunks.push(chunk)
      length += chunk.length
    }
    const bytes = new Uint8Array(length)
    length = 0
    for (const chunk of chunks) {
      bytes.set(chunk, length)
      length += chunk.length
    }
    return bytes
  })()
}

describe('CarWriter', () => {
  /** @type {Block[]} */
  let cborBlocks
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
    allBlocksFlattened = data.allBlocksFlattened
    roots = [cborBlocks[0].cid, cborBlocks[1].cid]
  })

  it('complete', async () => {
    const { writer, out } = create(roots)

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
    const { writer, out } = create(roots)

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

  it('complete, no queue', async () => {
    const { writer, out } = create(roots)
    const collection = collector(out)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection
    assertCarData(bytes)
  })

  it('complete, no queue, deferred collection', async () => {
    const { writer, out } = create(roots)

    for (const block of allBlocksFlattened) {
      writer.put(block)
    }
    writer.close()

    const collection = collector(out)
    const bytes = await collection
    assertCarData(bytes)
  })

  it('single root', async () => {
    const { writer, out } = create(roots[0])
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

  it('no roots', async () => {
    const { writer, out } = create()
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

  it('bad argument for create()', () => {
    for (const arg of [new Uint8Array(0), true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // @ts-ignore
      assert.throws(() => create(arg))
    }
  })

  it('bad argument for put()', async () => {
    const { writer } = create()
    for (const arg of [new Uint8Array(0), true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // @ts-ignore
      await assert.isRejected(writer.put(arg))
    }

    for (const arg of [true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // @ts-ignore
      await assert.isRejected(writer.put({ bytes: new Uint8Array(0), cid: arg }))
    }

    for (const arg of [true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      // @ts-ignore
      await assert.isRejected(writer.put({ cid: rndCid, bytes: arg }))
    }
  })

  it('bad attempt to multiple iterate', async () => {
    const { out } = create()
    collector(out)
    await assert.isRejected(collector(out), /multiple iterator/i)
  })

  it('bad attempt to multiple close', async () => {
    const { writer, out } = create()
    collector(out)
    await writer.close()
    await assert.isRejected(writer.close(), /closed/i)
  })
})
