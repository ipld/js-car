/* eslint-env mocha */

import { CarReader } from 'datastore-car'
import { Block, carBytes, makeIterable, assert } from './common.js'
import {
  verifyRoots,
  verifyHas,
  verifyGet,
  verifyBlocks,
  verifyCids
} from './verify-store-reader.js'

describe('CarReader.fromBytes()', () => {
  it('complete', async () => {
    const reader = await CarReader(Block).fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('complete (get before has) switch', async () => {
    const reader = await CarReader(Block).fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyGet(reader)
    await verifyHas(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('bad argument', async () => {
    for (const arg of [true, false, null, undefined, 'string', 100, { obj: 'nope' }]) {
      await assert.isRejected(CarReader(Block).fromBytes(arg))
    }
  })

  it('decode error - truncated', async () => {
    await assert.isRejected(CarReader(Block).fromBytes(carBytes.slice(0, carBytes.length - 10)), {
      name: 'Error',
      message: 'Unexpected end of data'
    })
  })
})

describe('CarReader.fromIterable()', () => {
  it('complete (single chunk)', async () => {
    const reader = await CarReader(Block).fromIterable(makeIterable(carBytes, carBytes.length))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('complete (101-byte chunks)', async () => {
    const reader = await CarReader(Block).fromIterable(makeIterable(carBytes, 101))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('complete (64-byte chunks)', async () => {
    const reader = await CarReader(Block).fromIterable(makeIterable(carBytes, 64))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('complete (32-byte chunks)', async () => {
    const reader = await CarReader(Block).fromIterable(makeIterable(carBytes, 32))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader)
    await verifyCids(reader)
  })

  it('bad argument', async () => {
    for (const arg of [new Uint8Array(0), true, false, null, undefined, 'string', 100, { obj: 'nope' }]) {
      await assert.isRejected(CarReader(Block).fromIterable(arg))
    }
  })

  it('decode error - truncated', async () => {
    await assert.isRejected(CarReader(Block).fromIterable(makeIterable(carBytes.slice(0, carBytes.length - 10), 64)), {
      name: 'Error',
      message: 'Unexpected end of data'
    })
  })
})
