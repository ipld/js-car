/* eslint-env mocha */

const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
const bl = require('bl')
fs.readFile = promisify(fs.readFile)
fs.unlink = promisify(fs.unlink)
const { verifyDecoded, makeData } = require('./fixture-data')
const Car = require('../')

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
    await Car.encodeFile(path.join(__dirname, 'test.car'), roots, allBlocks)
    const decoded = await Car.decodeFile(path.join(__dirname, 'test.car'))
    return verifyDecoded(decoded)
  })

  it('encodeBuffer', async () => {
    const buf = await Car.encodeBuffer(roots, allBlocks)
    const decoded = await Car.decodeBuffer(buf)
    return verifyDecoded(decoded)
  })

  it('encodeStream', async () => {
    const stream = bl()
    const carStream = Car.encodeStream(roots, allBlocks)
    carStream.pipe(stream)
    await new Promise((resolve, reject) => {
      carStream.on('finish', resolve)
      carStream.on('error', reject)
      stream.on('error', reject)
    })

    const decoded = await Car.decodeStream(stream)
    return verifyDecoded(decoded)
  })
})
