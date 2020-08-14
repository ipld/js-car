/* eslint-env mocha */

import assert from 'assert'
import fs from 'fs'
import garbage from 'garbage'
import varint from 'varint'
import multiformats from 'multiformats/basics.js'
import dagCbor from '@ipld/dag-cbor'
import Car from '../car.js'
import { promisify } from 'util'

const unlink = promisify(fs.unlink)

multiformats.add(dagCbor)
const { writeStream, readFileComplete, readStreaming, indexer } = Car(multiformats)

describe('Large CAR', () => {
  const objects = []
  const cids = []
  const expectedIndex = []

  it('create, no roots', async () => {
    const carDs = await writeStream(fs.createWriteStream('./test.car'))

    // offset starts at header length
    let offset = multiformats.encode({ version: 1, roots: [] }, 'dag-cbor').length
    offset += varint.encode(offset.length).length

    for (let i = 0; i < 500; i++) {
      const obj = garbage.object(1000)
      objects.push(obj)
      const binary = await multiformats.encode(obj, 'dag-cbor')
      const mh = await multiformats.multihash.hash(binary, 'sha2-256')
      const cid = new multiformats.CID(1, multiformats.get('dag-cbor').code, mh)
      cids.push(cid.toString())
      const blockLength = binary.length
      let length = cid.buffer.length + blockLength
      const lengthLength = varint.encode(length).length
      length += lengthLength
      const blockOffset = offset + lengthLength + cid.buffer.length
      expectedIndex.push({ cid, offset, length, blockOffset, blockLength })
      offset += length
      await carDs.put(cid, binary)
    }

    await carDs.close()
  })

  it('indexer stream', async () => {
    const index = await indexer(fs.createReadStream('./test.car'))
    assert.deepStrictEqual(index.roots, [])
    let i = 0
    for await (const blockIndex of index.iterator) {
      assert.deepStrictEqual(blockIndex, expectedIndex[i])
      i++
    }
  })

  it('indexer file', async () => {
    const index = await indexer('./test.car')
    assert.deepStrictEqual(index.roots, [])
    let i = 0
    for await (const blockIndex of index.iterator) {
      assert.deepStrictEqual(blockIndex, expectedIndex[i])
      i++
    }
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
