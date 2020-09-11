/* eslint-env mocha */

import { CarWriter } from 'datastore-car'
import { Block, carBytes, makeData, assert } from './common.js'

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
      Block.multiformats.bytes.toHex(actual),
      Block.multiformats.bytes.toHex(carBytes),
      'got expected bytes'
    )
  }

  before(async () => {
    const data = await makeData()
    cborBlocks = data.cborBlocks
    allBlocksFlattened = data.allBlocksFlattened
    roots = [
      await cborBlocks[0].cid(),
      await cborBlocks[1].cid()
    ]
  })

  it('complete', async () => {
    const writer = CarWriter(Block).create(roots)

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
    const writer = CarWriter(Block).create(roots)

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
    const writer = CarWriter(Block).create(roots)
    const collection = collector(writer)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const bytes = await collection
    assertCarData(bytes)
  })

  it('complete, no queue, deferred collection', async () => {
    const writer = CarWriter(Block).create(roots)

    for (const block of allBlocksFlattened) {
      await writer.put(block)
    }
    await writer.close()

    const collection = collector(writer)
    const bytes = await collection
    assertCarData(bytes)
  })
})
