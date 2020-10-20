/* eslint-env mocha */

import { CarWriter } from '@ipld/car'
import { bytes } from 'multiformats'
import { carBytes, makeData, assert } from './common.js'

const { toHex } = bytes

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
  let cborBlocks
  let allBlocksFlattened
  let roots

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
    const writer = CarWriter.create(roots)

    // writer is async iterable
    assert.strictEqual(typeof writer[Symbol.asyncIterator], 'function')
    const collection = collector(writer)

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
    assert.strictEqual(written, true)

    assertCarData(bytes)
  })

  it('complete, deferred collection', async () => {
    const writer = CarWriter.create(roots)

    const writeQueue = []
    for (const block of allBlocksFlattened) {
      writeQueue.push(writer.put(block))
    }
    writeQueue.push(writer.close())

    let written = false
    Promise.all(writeQueue).then(() => {
      written = true
    })

    // attach to the iterator after we've done the writing
    const collection = collector(writer)

    const bytes = await collection
    assert.strictEqual(written, true)

    assertCarData(bytes)
  })

  it('complete, no queue', async () => {
    const writer = CarWriter.create(roots)
    const collection = collector(writer)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection
    assertCarData(bytes)
  })

  it('complete, no queue, deferred collection', async () => {
    const writer = CarWriter.create(roots)

    for (const block of allBlocksFlattened) {
      writer.put(block)
    }
    writer.close()

    const collection = collector(writer)
    const bytes = await collection
    assertCarData(bytes)
  })

  it('single root', async () => {
    const writer = CarWriter.create(roots[0])
    const collection = collector(writer)

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
    const writer = CarWriter.create()
    const collection = collector(writer)

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
      assert.throws(() => CarWriter.create(arg))
    }
  })

  it('bad argument for put()', async () => {
    const writer = CarWriter.create()
    for (const arg of [new Uint8Array(0), true, false, null, 'string', 100, { obj: 'nope' }, [false]]) {
      await assert.isRejected(writer.put(arg))
    }
  })

  it('bad attempt to multiple iterate', async () => {
    const writer = CarWriter.create()
    collector(writer)
    await assert.isRejected(collector(writer), /multiple iterator/i)
  })

  it('bad attempt to multiple close', async () => {
    const writer = CarWriter.create()
    collector(writer)
    await writer.close()
    await assert.isRejected(writer.close(), /closed/i)
  })
})
