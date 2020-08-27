/* eslint-env mocha */

import assert from 'assert'
import multiformats from 'multiformats/basics'
import { acid, car, makeData, verifyBlocks, verifyHas, verifyRoots } from './fixture-data.js'
import dagCbor from '@ipld/dag-cbor'
import base58 from 'multiformats/bases/base58'
import Car from 'datastore-car'

multiformats.add(dagCbor)
multiformats.multibase.add(base58)
const { readBuffer } = Car(multiformats)

if (!assert.rejects) {
  // browser polyfill is incomplete
  assert.rejects = async (promise, msg) => {
    try {
      await promise
    } catch (err) {
      return
    }
    assert.fail(`Promise did not reject: ${msg}`)
  }
}

let rawBlocks

describe('Read Buffer', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
  })

  it('read existing', async () => {
    const carDs = await readBuffer(car)
    await verifyHas(carDs)
    await verifyBlocks(carDs)
    await verifyRoots(carDs)
    await assert.rejects(carDs.get(rawBlocks[3].cid)) // doesn't exist
    await carDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const carDs = await readBuffer(car)
    await verifyRoots(carDs)
    await carDs.close()
  })

  // when we instantiate from a Uint8Array, CarDatastore should be immutable
  it('immutable', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.put(acid, new TextEncoder().encode('blip')))
    await assert.rejects(carDs.delete(acid, new TextEncoder().encode('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
