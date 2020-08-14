/* eslint-env mocha */

import assert from 'assert'
import multiformats from 'multiformats/basics.js'
import { PassThrough } from 'stream'

import IpldBlock from '@ipld/block'
import Car from '../car.js'
import dagCbor from '@ipld/dag-cbor'
import base58 from 'multiformats/bases/base58.js'

multiformats.add(dagCbor)
multiformats.multibase.add(base58)
const { writeStream, readBuffer, completeGraph } = Car(multiformats)
const Block = IpldBlock(multiformats)

const same = assert.deepStrictEqual

function all (car) {
  const _traverse = async function * (link, seen = new Set()) {
    link = await link
    seen.add(link.toString('base64'))
    const encoded = await car.get(link)
    const block = Block.create(encoded, link)
    yield block
    const cid = await block.cid()
    if (cid.code === 0x55) {
      return
    }

    for (const [, link] of block.reader().links()) {
      if (seen.has(link.toString('base64'))) {
        continue
      }
      yield * _traverse(link, seen)
    }
  }

  return _traverse(car.getRoots().then(([root]) => root))
}

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
  return Buffer.concat(buffers)
}

describe('Create car for full graph', () => {
  it('small graph', async () => {
    const leaf1 = Block.encoder({ hello: 'world' }, 'dag-cbor')
    const leaf2 = Block.encoder({ test: 1 }, 'dag-cbor')
    const raw = Block.encoder(Buffer.from('test'), 'raw')
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

    const reader = await readBuffer(data)
    const [readRoot, ...more] = await reader.getRoots()
    same(more.length, 0)
    assert.ok(readRoot.equals(await root.cid()))

    for await (const block of all(reader)) {
      const expectedBlock = expected.shift()
      assert.ok((await expectedBlock.cid()).equals(await block.cid()))
    }
  })
})
