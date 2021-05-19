/* eslint-env mocha */

import { CarReader } from '@ipld/car/reader'
import { carBytes, makeIterable, assert } from './common.js'
import {
  verifyRoots,
  verifyHas,
  verifyGet,
  verifyBlocks,
  verifyCids
} from './verify-store-reader.js'

describe('CarReader fromBytes()', () => {
  it('complete', async () => {
    const reader = await CarReader.fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
    assert.strictEqual(reader.version, 1)
  })

  it('complete (get before has) switch', async () => {
    const reader = await CarReader.fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyGet(reader)
    await verifyHas(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('bad argument', async () => {
    for (const arg of [true, false, null, undefined, 'string', 100, { obj: 'nope' }]) {
      // @ts-ignore
      await assert.isRejected(CarReader.fromBytes(arg))
    }
  })

  it('decode error - truncated', async () => {
    await assert.isRejected(CarReader.fromBytes(carBytes.slice(0, carBytes.length - 10)), {
      name: 'Error',
      message: 'Unexpected end of data'
    })
  })
})

describe('CarReader fromIterable()', () => {
  it('complete (single chunk)', async () => {
    const reader = await CarReader.fromIterable(makeIterable(carBytes, carBytes.length))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('complete (101-byte chunks)', async () => {
    const reader = await CarReader.fromIterable(makeIterable(carBytes, 101))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('complete (64-byte chunks)', async () => {
    const reader = await CarReader.fromIterable(makeIterable(carBytes, 64))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('complete (32-byte chunks)', async () => {
    const reader = await CarReader.fromIterable(makeIterable(carBytes, 32))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('bad argument', async () => {
    for (const arg of [new Uint8Array(0), true, false, null, undefined, 'string', 100, { obj: 'nope' }]) {
      // @ts-ignore
      await assert.isRejected(CarReader.fromIterable(arg))
    }
  })

  it('decode error - truncated', async () => {
    await assert.isRejected(CarReader.fromIterable(makeIterable(carBytes.slice(0, carBytes.length - 10), 64)), {
      name: 'Error',
      message: 'Unexpected end of data'
    })
  })
})
