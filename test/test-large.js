/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const unlink = require('util').promisify(require('fs').unlink)
const garbage = require('garbage')
const multiformats = require('multiformats/basics')
multiformats.add(require('@ipld/dag-cbor'))
const { writeStream, readFileComplete, readStreaming } = require('../')(multiformats)

describe('Large CAR', () => {
  const objects = []
  const cids = []

  it('create, no roots', async () => {
    const carDs = await writeStream(fs.createWriteStream('./test.car'))

    for (let i = 0; i < 500; i++) {
      const obj = garbage.object(1000)
      objects.push(obj)
      const binary = await multiformats.encode(obj, 'dag-cbor')
      const mh = await multiformats.multihash.hash(binary, 'sha2-256')
      const cid = new multiformats.CID(1, multiformats.get('dag-cbor').code, mh)
      cids.push(cid.toString())
      await carDs.put(cid, binary)
    }

    return carDs.close()
  })

  it('readFileComplete', async () => {
    const carDs = await readFileComplete('./test.car')
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      const obj = await multiformats.decode(value, 'dag-cbor')
      assert.deepStrictEqual(obj, objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  it('readStream', async () => {
    const carDs = await readStreaming(fs.createReadStream('./test.car'))
    let i = 0
    for await (const { key, value } of carDs.query()) {
      assert.strictEqual(key, cids[i], `cid #${i} ${key} <> ${cids[i]}`)
      const obj = await multiformats.decode(value, 'dag-cbor')
      assert.deepStrictEqual(obj, objects[i], `object #${i}`)
      i++
    }

    return carDs.close()
  })

  after(async () => {
    return unlink('./test.car').catch(() => {})
  })
})
