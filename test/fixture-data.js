const assert = require('assert')

const CID = require('cids')
const Block = require('@ipld/block')
const { DAGNode, DAGLink } = require('ipld-dag-pb')
const pbUtil = require('ipld-dag-pb').util

const rawBlocks = 'aaaa bbbb cccc zzzz'.split(' ').map((s) => Block.encoder(Buffer.from(s), 'raw'))
const pbBlocks = []
const cborBlocks = []
const allBlocks = [['raw', rawBlocks.slice(0, 3)], ['pb', pbBlocks], ['cbor', cborBlocks]]
let allBlocksFlattened

const acid = new CID('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm')

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

// TODO: delete this when not needed
async function verifyDecoded (decoded, singleRoot) {
  await makeData()

  assert.strictEqual(decoded.version, 1)
  assert.strictEqual(decoded.roots.length, singleRoot ? 1 : 2)
  assert.strictEqual(decoded.roots[0].toString(), (await cborBlocks[0].cid()).toString())
  if (!singleRoot) {
    assert.strictEqual(decoded.roots[1].toString(), (await cborBlocks[1].cid()).toString())
  }
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

async function verifyHas (carDs, modified) {
  async function verifyHas (cid, name) {
    assert.ok(await carDs.has(cid), `datastore doesn't have expected key for ${name}`)
  }

  async function verifyHasnt (cid, name) {
    assert.ok(!(await carDs.has(cid)), `datastore has unexpected key for ${name}`)
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < blocks.length; i++) {
      if (modified && i === 1) {
        // second of each type is removed from modified
        await verifyHasnt(await blocks[i].cid(), `block #${i} (${type} / ${await blocks[i].cid()})`)
      } else {
        await verifyHas(await blocks[i].cid(), `block #${i} (${type} / ${await blocks[i].cid()})`)
      }
    }

    if (modified && type === 'raw') {
      await verifyHas(await rawBlocks[3].cid(), `block #3 (${type})`) // zzzz
    }
  }

  // not a block we have
  await verifyHasnt(await Block.encoder(Buffer.from('dddd'), 'raw').cid(), 'dddd')
}

function compareBlockData (actual, expected, id) {
  assert.strictEqual(Buffer.from(actual).toString('hex'), Buffer.from(expected).toString('hex'), `comparing block as hex ${id}`)
}

async function verifyBlocks (carDs, modified) {
  async function verifyBlock (block, index, type) {
    const expected = await block.encode()
    let actual
    try {
      actual = await carDs.get(await block.cid())
    } catch (err) {
      assert.ifError(err, `get block length #${index} (${type})`)
    }
    compareBlockData(actual, expected, `#${index} (${type})`)
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      if (modified && i === 1) {
        await assert.rejects(carDs.get(await block.cid()), {
          name: 'Error',
          message: 'Not Found'
        })
        continue
      }

      await verifyBlock(block, i, type)
    }

    if (modified && type === 'raw') {
      await verifyBlock(rawBlocks[3], 3, type) // zzzz
    }
  }
}

async function verifyRoots (carDs, modified) {
  // const expected = await cborBlocks[modified ? 1 : 2].cid()
  const expected = [await cborBlocks[0].cid(), await cborBlocks[1].cid()]
  assert.deepStrictEqual(await carDs.getRoots(), expected)
}

module.exports.makeData = makeData
module.exports.verifyBlocks = verifyBlocks
module.exports.verifyHas = verifyHas
module.exports.verifyRoots = verifyRoots
module.exports.acid = acid
module.exports.compareBlockData = compareBlockData

// TODO: delete?
module.exports.verifyDecoded = verifyDecoded

module.exports.car = Buffer.from('63a265726f6f747382d82a58250001711220f88bc853804cf294fe417e4fa83028689fcdb1b1592c5102e1474dbc200fab8bd82a5825000171122069ea0740f9807a28f4d932c62e7c1c83be055e55072c90266ab3e79df63a365b6776657273696f6e01280155122061be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b461616161280155122081cc5b17018674b401b42f35ba07bb79e211239c23bffe658da1577e3e646877626262622801551220b6fbd675f98e2abd22d4ed29fdc83150fedc48597e92dd1a7a24381d44a2745163636363511220e7dc486e97e6ebe5cdabab3e392bdad128b6e09acc94bb4e2aa2af7b986d24d0122d0a240155122061be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b4120363617418048001122079a982de3c9907953d4d323cee1d0fb1ed8f45f8ef02870c0cb9e09246bd530a122d0a240155122081cc5b17018674b401b42f35ba07bb79e211239c23bffe658da1577e3e6468771203646f671804122d0a221220e7dc486e97e6ebe5cdabab3e392bdad128b6e09acc94bb4e2aa2af7b986d24d01205666972737418338301122002acecc5de2438ea4126a3010ecb1f8a599c8eff22fff1a1dcffe999b27fd3de122e0a2401551220b6fbd675f98e2abd22d4ed29fdc83150fedc48597e92dd1a7a24381d44a274511204626561721804122f0a22122079a982de3c9907953d4d323cee1d0fb1ed8f45f8ef02870c0cb9e09246bd530a12067365636f6e641895015b01711220f88bc853804cf294fe417e4fa83028689fcdb1b1592c5102e1474dbc200fab8ba2646c696e6bd82a582300122002acecc5de2438ea4126a3010ecb1f8a599c8eff22fff1a1dcffe999b27fd3de646e616d6564626c6970360171122069ea0740f9807a28f4d932c62e7c1c83be055e55072c90266ab3e79df63a365ba2646c696e6bf6646e616d65656c696d626f', 'hex')
