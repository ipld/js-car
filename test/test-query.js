/* eslint-env mocha */

const assert = require('assert')
const path = require('path')
const multiformats = require('multiformats/basics.js')
multiformats.add(require('@ipld/dag-cbor'))
multiformats.multibase.add(require('multiformats/bases/base58.js'))
const { readBuffer, readFile } = require('../')(multiformats)
const { car, makeData, compareBlockData } = require('./fixture-data')

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

const factories = [['readBuffer', () => readBuffer(car)]]
if (readFile) { // not in browser
  factories.push(['readFile', () => readFile(path.join(__dirname, 'go.car'))])
}

for (const [factoryName, factoryFn] of factories) {
  let blocks

  describe('query', () => {
    before(async () => {
      const data = await makeData()
      blocks = data.rawBlocks.slice(0, 3).concat(data.pbBlocks).concat(data.cborBlocks)
    })

    it(`${factoryName} {}`, async () => {
      const carDs = await factoryFn()
      const blocks_ = blocks.slice()
      const cids = []
      for (const block of blocks) {
        cids.push(block.cid.toString())
      }
      let i = 0
      for await (const entry of carDs.query()) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        compareBlockData(entry.value, blocks_[foundIndex].binary, `#${i++}`)
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await carDs.close()
    })

    it(`${factoryName} {keysOnly}`, async () => {
      const carDs = await factoryFn()
      const blocks_ = blocks.slice()
      const cids = []
      for (const block of blocks) {
        cids.push(block.cid.toString())
      }
      for await (const entry of carDs.query({ keysOnly: true })) {
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

    it(`${factoryName} {filters}`, async () => {
      const carDs = await factoryFn()
      const blocks_ = []
      const cids = []
      for (const block of blocks) {
        const cid = new multiformats.CID(block.cid.toString())
        if (cid.code === multiformats.get('dag-cbor').code) {
          cids.push(cid.toString())
          blocks_.push(block)
        }
      }
      const filter = (e) => e.key.startsWith('bafyrei')
      let i = 0
      for await (const entry of carDs.query({ filters: [filter] })) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        compareBlockData(entry.value, blocks_[foundIndex].binary, `#${i++}`)
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await carDs.close()
    })
  })
}
