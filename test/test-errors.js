/* eslint-env mocha */
import { CarReader } from '@ipld/car/reader'
import { carBytes, assert } from './common.js'

describe('Misc errors', () => {
  const buf = carBytes.slice()

  it('decode errors', async () => {
    // cid v0
    const buf2 = new Uint8Array(buf.length)
    buf2.set(buf, 0)
    buf2[101] = 0 // first block's CID
    await assert.isRejected(CarReader.fromBytes(buf2), {
      name: 'Error',
      message: 'Unexpected CID version (0)'
    })
  })
})
