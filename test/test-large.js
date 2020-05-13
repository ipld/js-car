/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const unlink = require('util').promisify(require('fs').unlink)
const garbage = require('garbage')
// TODO: removeme
const { serialize: dagCborSerialize, deserialize: dagCborDeserialize, cid: dagCborCid } = require('ipld-dag-cbor').util
const { writeStream, readFileComplete, readStreaming } = require('../')
const multiformats = require('multiformats/basics')
multiformats.add(require('@ipld/dag-cbor'))

describe('Large CAR', () => {
  const objects = []
  const cids = []

  it('create, no roots', async () => {
    const carDs = await writeStream(multiformats, fs.createWriteStream('./test.car'))

    for (let i = 0; i < 500; i++) {
      const obj = garbage.object(1000)
      objects.push(obj)
      const binary = dagCborSerialize(obj)
      const cid = new multiformats.CID((await dagCborCid(binary)).toString())
      cids.push(cid.toString())
      await carDs.put(cid, binary)
    }

    return carDs.close()
  })

  it('readFileComplete', async () => {
    const carDs = await readFileComplete(multiformats, './test.car')
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      const obj = dagCborDeserialize(value)
      assert.deepStrictEqual(obj, objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  it('readStream', async () => {
    const carDs = await readStreaming(multiformats, fs.createReadStream('./test.car'))
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      const obj = dagCborDeserialize(value)
      assert.deepStrictEqual(obj, objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  after(async () => {
    return unlink('./test.car').catch(() => {})
  })
})
