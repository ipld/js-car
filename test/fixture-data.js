import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import Block from '@ipld/block/basics'

import dagCbor from '@ipld/dag-cbor'
import dagPb from '@ipld/dag-pb'
import base58 from 'multiformats/bases/base58'

chai.use(chaiAsPromised)
const { assert } = chai

const { multiformats, CID } = Block
const { bytes } = multiformats
multiformats.add(dagCbor)
multiformats.add(dagPb)
multiformats.multibase.add(base58)

let rawBlocks
const pbBlocks = []
const cborBlocks = []
let allBlocks
let allBlocksFlattened

const acid = CID.from('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm')

async function toCidv0Block (block) {
  const cid = CID.create(0, block.code, (await block.cid()).multihash)
  return Block.create(block.encodeUnsafe(), cid)
}

async function makeData () {
  if (!rawBlocks) {
    rawBlocks = 'aaaa bbbb cccc zzzz'.split(' ').map((s) => {
      return Block.encoder(new TextEncoder().encode(s), 'raw')
    })

    const toPbLink = async (name, block) => {
      let size = block.encode().length
      if ((await block.cid()).code === 0x70) {
        // special cumulative size handling for linking to dag-pb blocks
        size = block.decode().Links.reduce((p, c) => p + c.Tsize, size)
      }
      return {
        Name: name,
        Tsize: size,
        Hash: await block.cid()
      }
    }

    pbBlocks.push(await toCidv0Block(Block.encoder({
      Links: [
        await toPbLink('cat', rawBlocks[0])
      ]
    }, 'dag-pb')))
    pbBlocks.push(await toCidv0Block(Block.encoder({
      Links: [
        await toPbLink('dog', rawBlocks[1]),
        await toPbLink('first', pbBlocks[0])
      ]
    }, 'dag-pb')))
    pbBlocks.push(await toCidv0Block(Block.encoder({
      Links: [
        await toPbLink('bear', rawBlocks[2]),
        await toPbLink('second', pbBlocks[1])
      ]
    }, 'dag-pb')))

    const cbstructs = [['blip', await pbBlocks[2].cid()], ['limbo', null]]
    for (const b of cbstructs) {
      cborBlocks.push(Block.encoder({ name: b[0], link: b[1] }, 'dag-cbor'))
    }

    allBlocks = [['raw', rawBlocks.slice(0, 3)], ['pb', pbBlocks], ['cbor', cborBlocks]]
    allBlocksFlattened = allBlocks.reduce((p, c) => p.concat(c[1]), [])
  }

  return {
    rawBlocks,
    pbBlocks,
    cborBlocks,
    allBlocks,
    allBlocksFlattened
  }
}

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
    const cid = block.cid
    const index = expectedCids.indexOf(cid.toString())
    assert.ok(index >= 0, 'got expected block')
    assert.strictEqual(
      bytes.toHex(expectedBlocks[index].encode()),
      bytes.toHex(block.binary),
      'got expected block content')
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
    await assert.isRejected(carDs.get(cid), {
      name: 'Error',
      message: 'Not Found'
    })
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
      await verifyHas(rawBlocks[3].cid, `block #3 (${type})`) // zzzz
    }
  }

  // not a block we have
  await verifyHasnt(await Block.encoder(new TextEncoder().encode('dddd'), 'raw').cid(), 'dddd')
}

function compareBlockData (actual, expected, id) {
  assert.strictEqual(
    bytes.toHex(actual),
    bytes.toHex(expected),
    `comparing block as hex ${id}`
  )
}

async function verifyBlocks (carDs, modified) {
  async function verifyBlock (block, index, type) {
    const expected = block.encode()
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
        // TODO: I don't think this branch is called anymore ...
        await assert.isRejected(carDs.get(await block.cid()), {
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
  // using toString() for now, backing buffers in Uint8Arrays are getting in the way
  // in the browser
  const expected = [
    (await cborBlocks[0].cid()).toString(),
    (await cborBlocks[1].cid()).toString()
  ]
  assert.deepStrictEqual((await carDs.getRoots()).map((c) => c.toString()), expected)
}

const car = bytes.fromHex('63a265726f6f747382d82a58250001711220f88bc853804cf294fe417e4fa83028689fcdb1b1592c5102e1474dbc200fab8bd82a5825000171122069ea0740f9807a28f4d932c62e7c1c83be055e55072c90266ab3e79df63a365b6776657273696f6e01280155122061be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b461616161280155122081cc5b17018674b401b42f35ba07bb79e211239c23bffe658da1577e3e646877626262622801551220b6fbd675f98e2abd22d4ed29fdc83150fedc48597e92dd1a7a24381d44a2745163636363511220e7dc486e97e6ebe5cdabab3e392bdad128b6e09acc94bb4e2aa2af7b986d24d0122d0a240155122061be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b4120363617418048001122079a982de3c9907953d4d323cee1d0fb1ed8f45f8ef02870c0cb9e09246bd530a122d0a240155122081cc5b17018674b401b42f35ba07bb79e211239c23bffe658da1577e3e6468771203646f671804122d0a221220e7dc486e97e6ebe5cdabab3e392bdad128b6e09acc94bb4e2aa2af7b986d24d01205666972737418338301122002acecc5de2438ea4126a3010ecb1f8a599c8eff22fff1a1dcffe999b27fd3de122e0a2401551220b6fbd675f98e2abd22d4ed29fdc83150fedc48597e92dd1a7a24381d44a274511204626561721804122f0a22122079a982de3c9907953d4d323cee1d0fb1ed8f45f8ef02870c0cb9e09246bd530a12067365636f6e641895015b01711220f88bc853804cf294fe417e4fa83028689fcdb1b1592c5102e1474dbc200fab8ba2646c696e6bd82a582300122002acecc5de2438ea4126a3010ecb1f8a599c8eff22fff1a1dcffe999b27fd3de646e616d6564626c6970360171122069ea0740f9807a28f4d932c62e7c1c83be055e55072c90266ab3e79df63a365ba2646c696e6bf6646e616d65656c696d626f')

export {
  makeData,
  verifyBlocks,
  verifyHas,
  verifyRoots,
  acid,
  compareBlockData,
  verifyDecoded,
  car
}
