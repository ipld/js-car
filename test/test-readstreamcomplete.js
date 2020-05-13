/* eslint-env mocha */

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { readStreamComplete } = require('../car')
const { acid, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')
const multiformats = require('multiformats/basics')
multiformats.add(require('@ipld/dag-cbor'))
multiformats.multibase.add(require('multiformats/bases/base58'))

let rawBlocks

describe('Read Stream', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
  })

  it('read existing', async () => {
    const carDs = await readStreamComplete(multiformats, fs.createReadStream(path.join(__dirname, 'go.car')))
    await verifyHas(carDs)
    await verifyBlocks(carDs)
    await verifyRoots(carDs)
    await assert.rejects(carDs.get(rawBlocks[3].cid)) // doesn't exist
    await carDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const carDs = await readStreamComplete(multiformats, fs.createReadStream(path.join(__dirname, 'go.car')))
    await verifyRoots(carDs)
    await carDs.close()
  })

  // when we instantiate from a Stream, CarDatastore should be immutable
  it('immutable', async () => {
    const carDs = await readStreamComplete(multiformats, fs.createReadStream(path.join(__dirname, 'go.car')))
    await assert.rejects(carDs.put(acid, Buffer.from('blip')))
    await assert.rejects(carDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
