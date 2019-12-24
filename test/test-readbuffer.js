/* eslint-env mocha */

const assert = require('assert')
const { readBuffer } = require('../')
const { acid, car, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

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
    await assert.rejects(carDs.get(await rawBlocks[3].cid())) // doesn't exist
    await carDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const carDs = await readBuffer(car)
    await verifyRoots(carDs)
    await carDs.close()
  })

  // when we instantiate from a Buffer, CarDatastore should be immutable
  it('immutable', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.put(acid, Buffer.from('blip')))
    await assert.rejects(carDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
