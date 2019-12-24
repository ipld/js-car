/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const unlink = require('util').promisify(require('fs').unlink)
const { writeStream, readFile } = require('../')
const { makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

let rawBlocks
let pbBlocks
let cborBlocks

describe('Read File & Write Stream', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
    pbBlocks = data.pbBlocks
    cborBlocks = data.cborBlocks

    await unlink('./test.car').catch(() => {})
  })

  it('writeStream', async () => {
    const carDs = await writeStream(fs.createWriteStream('./test.car'))
    await carDs.setRoots([await cborBlocks[0].cid(), await cborBlocks[1].cid()])
    for (const block of rawBlocks.slice(0, 3).concat(pbBlocks).concat(cborBlocks)) {
      // add all but raw zzzz
      await carDs.put(await block.cid(), await block.encode())
    }
    await carDs.close()
  })

  it('readFile', async () => {
    const carDs = await readFile('./test.car')
    await verifyHas(carDs)
    await verifyBlocks(carDs)
    await verifyRoots(carDs)
    await carDs.close()
  })

  it('writeStream errors', async () => {
    const carDs = await writeStream(fs.createWriteStream('./test.car'))
    await carDs.put(await cborBlocks[0].cid(), await cborBlocks[0].encode())
    await assert.rejects(carDs.delete(await cborBlocks[0].cid()))
    await carDs.close()
    await assert.rejects(carDs.close())
  })

  after(async () => {
    unlink('./test.car').catch(() => {})
  })
})
