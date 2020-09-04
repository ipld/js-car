import { assert, Block, makeData } from './common.js'

// TODO: blocks()
// TODO: cids()

function compareBlockData (actual, expected, id) {
  assert.strictEqual(
    Block.multiformats.bytes.toHex(actual.encode()),
    Block.multiformats.bytes.toHex(expected.encode()),
    `comparing block as hex ${id}`
  )
}

async function verifyRoots (reader) {
  // using toString() for now, backing buffers in Uint8Arrays are getting in the way
  // in the browser
  const { cborBlocks } = await makeData()

  const expected = [
    (await cborBlocks[0].cid()).toString(),
    (await cborBlocks[1].cid()).toString()
  ]
  assert.deepStrictEqual((await reader.getRoots()).map((c) => c.toString()), expected)
}

async function verifyHas (reader) {
  const { allBlocks } = await makeData()

  const verifyHas = async (cid, name) => {
    assert.ok(await reader.has(cid), `reader doesn't have expected key for ${name}`)
  }

  const verifyHasnt = async (cid, name) => {
    assert.ok(!(await reader.has(cid)), `reader has unexpected key for ${name}`)
    assert.strictEqual(await reader.get(cid), undefined)
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < blocks.length; i++) {
      await verifyHas(await blocks[i].cid(), `block #${i} (${type} / ${await blocks[i].cid()})`)
    }
  }

  // not a block we have
  await verifyHasnt(await Block.encoder(new TextEncoder().encode('dddd'), 'raw').cid(), 'dddd')
}

async function verifyGet (reader) {
  const { allBlocks } = await makeData()

  const verifyBlock = async (expected, index, type) => {
    let actual
    try {
      actual = await reader.get(await expected.cid())
    } catch (err) {
      assert.ifError(err, `get block length #${index} (${type})`)
    }
    compareBlockData(actual, expected, `#${index} (${type})`)
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < blocks.length; i++) {
      await verifyBlock(blocks[i], i, type)
    }
  }
}

export {
  verifyRoots,
  verifyHas,
  verifyGet
}
