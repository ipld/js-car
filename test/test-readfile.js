/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const { readFileComplete } = require('../car')
const { acid, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

let rawBlocks

describe('Read File', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
  })

  it('read existing', async () => {
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await verifyHas(carDs)
    await verifyBlocks(carDs)
    await verifyRoots(carDs)
    await assert.rejects(carDs.get(await rawBlocks[3].cid())) // doesn't exist
    await carDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await verifyRoots(carDs)
    await carDs.close()
  })

  // when we instantiate from a File, CarDatastore should be immutable
  it('immutable', async () => {
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await assert.rejects(carDs.put(acid, Buffer.from('blip')))
    await assert.rejects(carDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
