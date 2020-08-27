/* eslint-env mocha */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { promisify } from 'util'
import fs from 'fs'
import bl from 'bl'
import multiformats from 'multiformats/basics'
import { verifyDecoded, makeData } from './fixture-data.js'
import * as coding from '../lib/coding.js'
import dagCbor from '@ipld/dag-cbor'

chai.use(chaiAsPromised)
const { assert } = chai

fs.readFile = promisify(fs.readFile)
fs.unlink = promisify(fs.unlink)
multiformats.add(dagCbor)

describe('Encode', () => {
  let roots, allBlocks

  const clean = async () => {
    return fs.unlink('test.car').catch(() => {})
  }

  before(async () => {
    const data = await makeData()
    allBlocks = data.allBlocksFlattened
    roots = []
    for (const block of data.cborBlocks) {
      roots.push(block.cid)
    }
  })

  beforeEach(clean)
  after(clean)

  it('encodeFile', async () => {
    await coding.encodeFile(multiformats, 'test.car', roots, allBlocks)
    const decoded = await coding.decodeFile(multiformats, 'test.car')
    return verifyDecoded(decoded)
  })

  it('encodeBuffer', async () => {
    const buf = await coding.encodeBuffer(multiformats, roots, allBlocks)
    const decoded = await coding.decodeBuffer(multiformats, buf)
    return verifyDecoded(decoded)
  })

  it('encodeBuffer single root', async () => {
    const buf = await coding.encodeBuffer(multiformats, roots[0], allBlocks)
    const decoded = await coding.decodeBuffer(multiformats, buf)
    return verifyDecoded(decoded, true)
  })

  it('encodeStream', async () => {
    const stream = bl()
    const carStream = coding.encodeStream(multiformats, roots, allBlocks)
    carStream.pipe(stream)
    await new Promise((resolve, reject) => {
      carStream.on('finish', resolve)
      carStream.on('error', reject)
      stream.on('error', reject)
    })

    const decoded = await coding.decodeStream(multiformats, stream)
    return verifyDecoded(decoded)
  })

  it('encode errors', async () => {
    await assert.isRejected(coding.encodeBuffer(multiformats, ['blip'], allBlocks), {
      name: 'TypeError',
      message: 'Roots must be CIDs'
    })

    await assert.isRejected(coding.encodeBuffer(multiformats, roots, ['blip']), {
      name: 'TypeError',
      message: 'Block list must be of type { cid, binary }'
    })
  })
})
