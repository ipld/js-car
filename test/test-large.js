/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const unlink = require('util').promisify(require('fs').unlink)
const garbage = require('garbage')
const Block = require('@ipld/block')
const { writeStream, readFileComplete, readStreaming } = require('../')

describe('Large CAR', () => {
  const objects = []
  const cids = []

  it('create, no roots', async () => {
    const carDs = await writeStream(fs.createWriteStream('./test.car'))

    for (let i = 0; i < 500; i++) {
      const obj = garbage.object(1000)
      objects.push(obj)
      const block = Block.encoder(obj, 'dag-cbor')
      const cid = await block.cid()
      cids.push(cid.toString())
      await carDs.put(cid, block.encode())
    }

    return carDs.close()
  })

  it('readFileComplete', async () => {
    const carDs = await readFileComplete('./test.car')
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      assert.deepStrictEqual(Block.create(value, key).decode(), objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  it('readStream', async () => {
    const carDs = await readStreaming(fs.createReadStream('./test.car'))
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      assert.deepStrictEqual(Block.create(value, key).decode(), objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  after(async () => {
    return unlink('./test.car').catch(() => {})
  })
})
