/* eslint-env mocha */

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
})
