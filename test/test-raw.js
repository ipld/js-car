/* eslint-env mocha */

const assert = require('assert')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
fs.open = promisify(fs.open)
fs.close = promisify(fs.close)
const multiformats = require('multiformats/basics.js')
multiformats.add(require('@ipld/dag-cbor'))
multiformats.multibase.add(require('multiformats/bases/base58.js'))
const { indexer, readRaw } = require('../')(multiformats)
const { makeData } = require('./fixture-data')

describe('Raw', () => {
  const expectedRoots = [
    new multiformats.CID('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'),
    new multiformats.CID('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm')
  ]
  const expectedIndex = [
    { cid: new multiformats.CID('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'), offset: 100, length: 92, blockOffset: 137, blockLength: 55 },
    { cid: new multiformats.CID('QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d'), offset: 192, length: 133, blockOffset: 228, blockLength: 97 },
    { cid: new multiformats.CID('bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke'), offset: 325, length: 41, blockOffset: 362, blockLength: 4 },
    { cid: new multiformats.CID('QmWXZxVQ9yZfhQxLD35eDR8LiMRsYtHxYqTFCBbJoiJVys'), offset: 366, length: 130, blockOffset: 402, blockLength: 94 },
    { cid: new multiformats.CID('bafkreiebzrnroamgos2adnbpgw5apo3z4iishhbdx77gldnbk57d4zdio4'), offset: 496, length: 41, blockOffset: 533, blockLength: 4 },
    { cid: new multiformats.CID('QmdwjhxpxzcMsR3qUuj7vUL8pbA7MgR3GAxWi2GLHjsKCT'), offset: 537, length: 82, blockOffset: 572, blockLength: 47 },
    { cid: new multiformats.CID('bafkreidbxzk2ryxwwtqxem4l3xyyjvw35yu4tcct4cqeqxwo47zhxgxqwq'), offset: 619, length: 41, blockOffset: 656, blockLength: 4 },
    { cid: new multiformats.CID('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'), offset: 660, length: 55, blockOffset: 697, blockLength: 18 }
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
      expectedCids.push(block.cid.toString())
    }

    for (const blockIndex of expectedIndex) {
      const block = await readRaw(fd, blockIndex)
      const cid = block.cid
      const index = expectedCids.indexOf(cid.toString())
      assert.ok(index >= 0, 'got expected block')
      assert.strictEqual(
        Buffer.from(expectedBlocks[index].binary).toString('hex'),
        Buffer.from(block.binary).toString('hex'),
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
    await assert.rejects(indexer(), {
      name: 'TypeError',
      message: 'indexer() requires a file path or a ReadableStream'
    })

    await assert.rejects(readRaw(true, expectedIndex[0]), {
      name: 'TypeError',
      message: 'Bad fd'
    })

    const badBlock = Object.assign({}, expectedIndex[expectedIndex.length - 1])
    badBlock.blockLength += 10
    const fd = await fs.open(path.join(__dirname, 'go.car'))
    await assert.rejects(readRaw(fd, badBlock), {
      name: 'Error',
      message: `Failed to read entire block (${badBlock.blockLength - 10} instead of ${badBlock.blockLength})`
    })
    await fs.close(fd)
  })
})
