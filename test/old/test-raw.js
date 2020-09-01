/* eslint-env mocha */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import multiformats from 'multiformats/basics'
import { makeData } from './fixture-data.js'
import Car from 'datastore-car'
import dagCbor from '@ipld/dag-cbor'
import base58 from 'multiformats/bases/base58'
import { fileURLToPath } from 'url'

chai.use(chaiAsPromised)
const { assert } = chai

const { CID } = multiformats

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

fs.open = promisify(fs.open)
fs.close = promisify(fs.close)

multiformats.add(dagCbor)
multiformats.multibase.add(base58)
const { indexer, readRaw } = Car(multiformats)

describe('Raw', () => {
  const expectedRoots = [
    CID.from('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'),
    CID.from('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm')
  ]
  const expectedIndex = [
    { cid: CID.from('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'), offset: 100, length: 92, blockOffset: 137, blockLength: 55 },
    { cid: CID.from('QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d'), offset: 192, length: 133, blockOffset: 228, blockLength: 97 },
    { cid: CID.from('bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke'), offset: 325, length: 41, blockOffset: 362, blockLength: 4 },
    { cid: CID.from('QmWXZxVQ9yZfhQxLD35eDR8LiMRsYtHxYqTFCBbJoiJVys'), offset: 366, length: 130, blockOffset: 402, blockLength: 94 },
    { cid: CID.from('bafkreiebzrnroamgos2adnbpgw5apo3z4iishhbdx77gldnbk57d4zdio4'), offset: 496, length: 41, blockOffset: 533, blockLength: 4 },
    { cid: CID.from('QmdwjhxpxzcMsR3qUuj7vUL8pbA7MgR3GAxWi2GLHjsKCT'), offset: 537, length: 82, blockOffset: 572, blockLength: 47 },
    { cid: CID.from('bafkreidbxzk2ryxwwtqxem4l3xyyjvw35yu4tcct4cqeqxwo47zhxgxqwq'), offset: 619, length: 41, blockOffset: 656, blockLength: 4 },
    { cid: CID.from('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'), offset: 660, length: 55, blockOffset: 697, blockLength: 18 }
  ]
  let allBlocksFlattened

  before(async () => {
    const data = await makeData()
    allBlocksFlattened = data.allBlocksFlattened
  })

  async function verifyIndex (index) {
    assert.deepStrictEqual(index.roots, expectedRoots)
    const actualIndex = []
    for await (const blockIndex of index.iterator) {
      actualIndex.push(blockIndex)
    }
    assert.deepStrictEqual(actualIndex, expectedIndex)
  }

  it('index a CAR (stream)', async () => {
    const index = await indexer(fs.createReadStream(path.join(__dirname, 'go.car')))
    await verifyIndex(index)
  })

  it('index a CAR (file)', async () => {
    const index = await indexer(path.join(__dirname, 'go.car'))
    await verifyIndex(index)
  })

  async function verifyRead (fd) {
    const expectedBlocks = allBlocksFlattened.slice()
    const expectedCids = []
    for (const block of expectedBlocks) {
      expectedCids.push((await block.cid()).toString())
    }

    for (const blockIndex of expectedIndex) {
      const block = await readRaw(fd, blockIndex)
      const cid = block.cid
      const index = expectedCids.indexOf(cid.toString())
      assert.ok(index >= 0, 'got expected block')
      assert.strictEqual(
        multiformats.bytes.toHex(expectedBlocks[index].encode()),
        multiformats.bytes.toHex(block.binary),
        'got expected block content')
      expectedBlocks.splice(index, 1)
      expectedCids.splice(index, 1)
    }
    assert.strictEqual(expectedBlocks.length, 0, 'got all expected blocks')
  }

  it('read raw using index (fd)', async () => {
    const fd = await fs.open(path.join(__dirname, 'go.car'))
    await verifyRead(fd)
    await fs.close(fd)
  })

  it('read raw using index (FileHandle)', async () => {
    const fd = await fs.promises.open(path.join(__dirname, 'go.car'))
    await verifyRead(fd)
    await fd.close(fd)
  })

  it('errors', async () => {
    await assert.isRejected(indexer(), {
      name: 'TypeError',
      message: 'indexer() requires a file path or a ReadableStream'
    })

    await assert.isRejected(readRaw(true, expectedIndex[0]), {
      name: 'TypeError',
      message: 'Bad fd'
    })

    const badBlock = Object.assign({}, expectedIndex[expectedIndex.length - 1])
    badBlock.blockLength += 10
    const fd = await fs.open(path.join(__dirname, 'go.car'))
    await assert.isRejected(readRaw(fd, badBlock), {
      name: 'Error',
      message: `Failed to read entire block (${badBlock.blockLength - 10} instead of ${badBlock.blockLength})`
    })
    await fs.close(fd)
  })
})
