/* eslint-env mocha */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'
import multiformats from 'multiformats/basics'
import { makeData, verifyDecoded } from './fixture-data.js'
import * as coding from '../lib/coding.js'
import dagCbor from '@ipld/dag-cbor'
import { fileURLToPath } from 'url'

chai.use(chaiAsPromised)
const { assert } = chai

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

fs.readFile = promisify(fs.readFile)
multiformats.add(dagCbor)

describe('Decode', () => {
  before(makeData)

  it('decodeFile', async () => {
    const decoded = await coding.decodeFile(multiformats, path.join(__dirname, 'go.car'))
    return verifyDecoded(decoded)
  })

  it('decodeFile small buffer', async () => {
    const decoded = await coding.decodeFile(multiformats, path.join(__dirname, 'go.car'), { bufferSize: 8 })
    return verifyDecoded(decoded)
  })

  it('decodeBuffer', async () => {
    const decoded = await coding.decodeBuffer(multiformats, await fs.readFile(path.join(__dirname, 'go.car')))
    return verifyDecoded(decoded)
  })

  it('decodeStream', async () => {
    const decoded = await coding.decodeStream(multiformats, fs.createReadStream(path.join(__dirname, 'go.car')))
    return verifyDecoded(decoded)
  })

  it('decode errors', async () => {
    const buf = await fs.readFile(path.join(__dirname, 'go.car'))
    // truncated
    await assert.isRejected(coding.decodeBuffer(multiformats, buf.slice(0, buf.length - 10)), {
      name: 'Error',
      message: 'Unexpected end of data'
    })

    // cid v0
    const buf2 = new Uint8Array(buf.length)
    buf.copy(buf2)
    buf2[101] = 0 // first block's CID
    await assert.isRejected(coding.decodeBuffer(multiformats, buf2), {
      name: 'Error',
      message: 'Unexpected CID version (0)'
    })
  })
})
