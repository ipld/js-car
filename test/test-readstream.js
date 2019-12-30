/* eslint-env mocha */

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { readStreaming } = require('../car')
const { acid, makeData, compareBlockData, verifyRoots } = require('./fixture-data')

describe('Read Stream', () => {
  let allBlocks
  before(async () => {
    const { allBlocksFlattened } = await makeData()
    allBlocks = allBlocksFlattened
  })

  it('read existing (query())', async () => {
    const blocks_ = allBlocks.slice()
    const cids = []
    for (const block of blocks_) {
      cids.push((await block.cid()).toString())
    }

    const carDs = await readStreaming(fs.createReadStream(path.join(__dirname, 'go.car')))

    let i = 0
    for await (const entry of carDs.query()) {
      assert.deepStrictEqual(Object.keys(entry), ['key', 'value'])
      const foundIndex = cids.findIndex((cid) => cid === entry.key)
      if (foundIndex < 0) {
        assert.fail(`Unexpected CID/key found: ${entry.key}`)
      }
      compareBlockData(entry.value, blocks_[foundIndex].encode(), `#${i++}`)
      cids.splice(foundIndex, 1)
      blocks_.splice(foundIndex, 1)
    }
    assert.strictEqual(cids.length, 0, 'found all expected CIDs')

    // test after
    await verifyRoots(carDs)

    await carDs.close()
  })

  it('read existing (query({keysOnly}))', async () => {
    const blocks_ = allBlocks.slice()
    const cids = []
    for (const block of blocks_) {
      cids.push((await block.cid()).toString())
    }

    const carDs = await readStreaming(fs.createReadStream(path.join(__dirname, 'go.car')))

    // test before
    await verifyRoots(carDs)

    for await (const entry of carDs.query({ keysOnly: true })) {
      assert.deepStrictEqual(Object.keys(entry), ['key'])
      const foundIndex = cids.findIndex((cid) => cid === entry.key)
      if (foundIndex < 0) {
        assert.fail(`Unexpected CID/key found: ${entry.key}`)
      }
      assert.strictEqual(entry.value, undefined, 'no `value`')
      cids.splice(foundIndex, 1)
      blocks_.splice(foundIndex, 1)
    }
    assert.strictEqual(cids.length, 0, 'found all expected CIDs')
    await carDs.close()
  })

  it('verify only roots', async () => {
    const carDs = await readStreaming(fs.createReadStream(path.join(__dirname, 'go.car')))
    await verifyRoots(carDs)
    await carDs.close()
  })

  it('errors & immutability', async () => {
    const carDs = await readStreaming(fs.createReadStream(path.join(__dirname, 'go.car')))
    await assert.rejects(carDs.has(await allBlocks[0].cid()))
    await assert.rejects(carDs.get(await allBlocks[0].cid()))

    // when we instantiate from a Stream, CarDatastore should be immutable
    await assert.rejects(carDs.put(acid, Buffer.from('blip')))
    await assert.rejects(carDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
