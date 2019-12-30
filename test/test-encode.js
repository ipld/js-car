/* eslint-env mocha */

const assert = require('assert')
const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const bl = require('bl')
fs.readFile = promisify(fs.readFile)
fs.unlink = promisify(fs.unlink)
const { verifyDecoded, makeData } = require('./fixture-data')
const coding = require('../lib/coding')

describe('Encode', () => {
  let roots, allBlocks

  const clean = () => {
    return fs.unlink('test.car').catch(() => {})
  }

  before(async () => {
    const data = await makeData()
    allBlocks = data.allBlocksFlattened
    roots = []
    for (const block of data.cborBlocks) {
      roots.push(await block.cid())
    }
  })

  beforeEach(clean)
  after(clean)

  it('encodeFile', async () => {
    await coding.encodeFile(path.join(__dirname, 'test.car'), roots, allBlocks)
    const decoded = await coding.decodeFile(path.join(__dirname, 'test.car'))
    return verifyDecoded(decoded)
  })

  it('encodeBuffer', async () => {
    const buf = await coding.encodeBuffer(roots, allBlocks)
    const decoded = await coding.decodeBuffer(buf)
    return verifyDecoded(decoded)
  })

  it('encodeBuffer single root', async () => {
    const buf = await coding.encodeBuffer(roots[0], allBlocks)
    const decoded = await coding.decodeBuffer(buf)
    return verifyDecoded(decoded, true)
  })

  it('encodeStream', async () => {
    const stream = bl()
    const carStream = coding.encodeStream(roots, allBlocks)
    carStream.pipe(stream)
    await new Promise((resolve, reject) => {
      carStream.on('finish', resolve)
      carStream.on('error', reject)
      stream.on('error', reject)
    })

    const decoded = await coding.decodeStream(stream)
    return verifyDecoded(decoded)
  })

  it('encode errors', async () => {
    await assert.rejects(coding.encodeBuffer(['blip'], allBlocks), {
      name: 'TypeError',
      message: 'Roots must be CIDs'
    })

    await assert.rejects(coding.encodeBuffer(roots, ['blip']), {
      name: 'TypeError',
      message: 'Block list must contain @ipld/block objects'
    })
  })
})
