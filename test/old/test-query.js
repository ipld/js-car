/* eslint-env mocha */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import path from 'path'
import multiformats from 'multiformats/basics'
import { car, makeData, compareBlockData } from './fixture-data.js'
import Car from 'datastore-car'
import dagCbor from '@ipld/dag-cbor'
import dagPb from '@ipld/dag-pb'
import base58 from 'multiformats/bases/base58'

chai.use(chaiAsPromised)
const { assert } = chai

multiformats.add(dagCbor)
multiformats.add(dagPb)
multiformats.multibase.add(base58)
const { readBuffer, readFile } = Car(multiformats)

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
        cids.push((await block.cid()).toString())
      }
      let i = 0
      for await (const entry of carDs.query()) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        compareBlockData(entry.value, blocks_[foundIndex].encode(), `#${i++}`)
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
        cids.push((await block.cid()).toString())
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
        const cid = multiformats.CID.from((await block.cid()).toString())
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
        compareBlockData(entry.value, blocks_[foundIndex].encode(), `#${i++}`)
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await carDs.close()
    })
  })
}
