/* eslint-env mocha */

const assert = require('assert')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
fs.open = promisify(fs.open)
fs.close = promisify(fs.close)
const CID = require('cids')
const { indexer, readRaw } = require('../')
const { makeData } = require('./fixture-data')

describe('Raw', () => {
  const expectedRoots = [
    new CID('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'),
    new CID('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm')
  ]
  const expectedIndex = [
    { cid: new CID('bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm'), length: 55, offset: 137 },
    { cid: new CID('QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d'), length: 97, offset: 228 },
    { cid: new CID('bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke'), length: 4, offset: 362 },
    { cid: new CID('QmWXZxVQ9yZfhQxLD35eDR8LiMRsYtHxYqTFCBbJoiJVys'), length: 94, offset: 402 },
    { cid: new CID('bafkreiebzrnroamgos2adnbpgw5apo3z4iishhbdx77gldnbk57d4zdio4'), length: 4, offset: 533 },
    { cid: new CID('QmdwjhxpxzcMsR3qUuj7vUL8pbA7MgR3GAxWi2GLHjsKCT'), length: 47, offset: 572 },
    { cid: new CID('bafkreidbxzk2ryxwwtqxem4l3xyyjvw35yu4tcct4cqeqxwo47zhxgxqwq'), length: 4, offset: 656 },
    { cid: new CID('bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'), length: 18, offset: 697 }
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
      const cid = await block.cid()
      const index = expectedCids.indexOf(cid.toString())
      assert.ok(index >= 0, 'got expected block')
      assert.strictEqual(expectedBlocks[index].encode().toString('hex'), block.encode().toString('hex'), 'got expected block content')
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
    badBlock.length += 10
    const fd = await fs.open(path.join(__dirname, 'go.car'))
    await assert.rejects(readRaw(fd, badBlock), {
      name: 'Error',
      message: `Failed to read entire block (${badBlock.length - 10} instead of ${badBlock.length})`
    })
    await fs.close(fd)
  })
})
