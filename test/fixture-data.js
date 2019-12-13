const assert = require('assert')

const Block = require('@ipld/block')
const { DAGNode, DAGLink } = require('ipld-dag-pb')
const pbUtil = require('ipld-dag-pb').util

const rawBlocks = 'aaaa bbbb cccc'.split(' ').map((s) => Block.encoder(Buffer.from(s), 'raw'))
const pbBlocks = []
const cborBlocks = []
const allBlocks = [['raw', rawBlocks], ['pb', pbBlocks], ['cbor', cborBlocks]]
let allBlocksFlattened

function toCBORStruct (name, link) {
  return { name, link }
}

async function toBlock (pnd) {
  const buf = pbUtil.serialize(pnd)
  const cid = await pbUtil.cid(buf, { cidVersion: 0 })
  return Block.create(buf, cid)
}

async function makeData () {
  if (!pbBlocks.length) {
    const pnd1 = new DAGNode(null, [
      new DAGLink('cat', await (rawBlocks[0].encode()).byteLength, await rawBlocks[0].cid())
    ])
    pbBlocks.push(await toBlock(pnd1))

    const pnd2 = new DAGNode(null, [
      new DAGLink('dog', await (rawBlocks[1].encode()).byteLength, await rawBlocks[1].cid()),
      new DAGLink('first', pnd1.size, await pbBlocks[0].cid())
    ])
    pbBlocks.push(await toBlock(pnd2))

    const pnd3 = new DAGNode(null, [
      new DAGLink('bear', await (rawBlocks[2].encode()).byteLength, await rawBlocks[2].cid()),
      new DAGLink('second', pnd2.size, await pbBlocks[1].cid())
    ])
    pbBlocks.push(await toBlock(pnd3))

    const cbstructs = [toCBORStruct('blip', await pbBlocks[2].cid()), toCBORStruct('limbo', null)]
    for (const b of cbstructs) {
      cborBlocks.push(Block.encoder(b, 'dag-cbor'))
    }
  }

  allBlocksFlattened = allBlocks.reduce((p, c) => p.concat(c[1]), [])

  return {
    rawBlocks,
    pbBlocks,
    cborBlocks,
    allBlocks,
    allBlocksFlattened
  }
}

async function verifyDecoded (decoded) {
  await makeData()

  assert.strictEqual(decoded.version, 1)
  assert.strictEqual(decoded.roots.length, 2)
  assert.strictEqual(decoded.roots[0].toString(), (await cborBlocks[0].cid()).toString())
  assert.strictEqual(decoded.roots[1].toString(), (await cborBlocks[1].cid()).toString())
  assert.strictEqual(decoded.blocks.length, allBlocksFlattened.length)

  const expectedBlocks = allBlocksFlattened.slice()
  const expectedCids = []
  for (const block of expectedBlocks) {
    expectedCids.push((await block.cid()).toString())
  }

  for (const block of decoded.blocks) {
    const cid = await block.cid()
    const index = expectedCids.indexOf(cid.toString())
    assert.ok(index >= 0, 'got expected block')
    assert.strictEqual(expectedBlocks[index].encode().toString('hex'), block.encode().toString('hex'), 'got expected block content')
    expectedBlocks.splice(index, 1)
    expectedCids.splice(index, 1)
  }

  assert.strictEqual(expectedCids.length, 0, 'got all expected blocks')
}

module.exports.makeData = makeData
module.exports.verifyDecoded = verifyDecoded
