/* eslint-env mocha */

import { CarReader } from 'datastore-car'
import { Block, carBytes, assert } from './common.js'
import { verifyRoots, verifyHas, verifyGet } from './verify-store-reader.js'

describe('CarReader.fromBytes()', () => {
  it('complete', async () => {
    const reader = await CarReader(Block).fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
  })

  it('complete (get before has) switch', async () => {
    const reader = await CarReader(Block).fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyGet(reader)
    await verifyHas(reader)
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
