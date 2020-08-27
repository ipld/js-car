/* eslint-env mocha */

import chai from 'chai'
import multiformats from 'multiformats/basics'
import stream from 'readable-stream'

import IpldBlock from '@ipld/block'
import Car from 'datastore-car'
import dagCbor from '@ipld/dag-cbor'
import base58 from 'multiformats/bases/base58'

const { assert } = chai

multiformats.add(dagCbor)
multiformats.multibase.add(base58)
const { writeStream, readBuffer, completeGraph } = Car(multiformats)
const Block = IpldBlock(multiformats)
const { PassThrough } = stream

async function createGet (blocks) {
  const db = new Map()
  for (const block of blocks) {
    db.set((await block.cid()).toString('base64'), block)
  }
  return (cid) => new Promise((resolve) => resolve(db.get(cid.toString('base64'))))
}

async function concat (stream) {
  const buffers = []
  for await (const buffer of stream) {
    buffers.push(buffer)
  }
  const ret = new Uint8Array(buffers.reduce((p, c) => p + c.length, 0))
  let off = 0
  for (const b of buffers) {
    ret.set(b, off)
    off += b.length
  }
  return ret
}

describe('Create car for full graph', () => {
  it('small graph', async () => {
    const leaf1 = Block.encoder({ hello: 'world' }, 'dag-cbor')
    const leaf2 = Block.encoder({ test: 1 }, 'dag-cbor')
    const raw = Block.encoder(new TextEncoder().encode('test'), 'raw')
    const root = Block.encoder(
      {
        one: await leaf1.cid(),
        two: await leaf2.cid(),
        three: await leaf1.cid(),
        zraw: await raw.cid()
      },
      'dag-cbor')
    const expected = [root, leaf1, leaf2, raw]

    const get = await createGet(expected)
    const stream = new PassThrough()
    const car = await writeStream(stream)
    await completeGraph(await root.cid(), get, car)
    const data = await concat(stream)

    const carDs = await readBuffer(data)
    const roots = await carDs.getRoots()
    assert.strictEqual(roots.length, 1)
    assert.deepStrictEqual(roots[0], await root.cid())

    for await (const { key: cid } of carDs.query()) {
      const expectedBlock = expected.shift()
      assert.strictEqual(cid, (await expectedBlock.cid()).toString())
    }
  })
})
