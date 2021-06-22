/* eslint-env mocha */
import { bytes } from 'multiformats'
import { encode as cbEncode } from '@ipld/dag-cbor'
import { encode as vEncode } from 'varint'
import { CarReader } from '@ipld/car/reader'
import { carBytes, assert, goCarV2Bytes } from './common.js'

/**
 * @param {any} block
 * @returns {Uint8Array}
 */
function makeHeader (block) {
  const u = cbEncode(block)
  const l = vEncode(u.length)
  const u2 = new Uint8Array(u.length + l.length)
  u2.set(l, 0)
  u2.set(u, l.length)
  return u2
}

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

  it('bad version', async () => {
    // quick sanity check that makeHeader() works properly!
    const buf2 = bytes.fromHex('0aa16776657273696f6e03')
    assert.strictEqual(bytes.toHex(makeHeader({ version: 3 })), '0aa16776657273696f6e03')
    // {version:3}
    await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR version: 3')
  })

  describe('bad header', async () => {
    it('sanity check', async () => {
      // sanity check, this should be fine
      const buf2 = makeHeader({ version: 1, roots: [] })
      await assert.isFulfilled(CarReader.fromBytes(buf2))
    })

    it('no \'version\' array', async () => {
      const buf2 = makeHeader({ roots: [] })
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('bad \'version\' type', async () => {
      const buf2 = makeHeader({ version: '1', roots: [] })
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('no \'roots\' array', async () => {
      const buf2 = makeHeader({ version: 1 })
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('bad \'roots\' type', async () => {
      const buf2 = makeHeader({ version: 1, roots: {} })
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('extraneous properties', async () => {
      const buf2 = makeHeader({ version: 1, roots: [], blip: true })
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('not an object', async () => {
      const buf2 = makeHeader([1, []])
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('not an object', async () => {
      const buf2 = makeHeader(null)
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR header format')
    })

    it('recursive v2 header', async () => {
      // first 51 bytes are the carv2 header:
      //   11b prefix, 16b characteristics, 8b data offset, 8b data size, 8b index offset
      const v2Header = goCarV2Bytes.slice(0, 51)
      // parser should expect to get a carv1 header at the data offset, but it uses the same
      // code to check the carv2 header so let's make sure it doesn't allow recursive carv2
      // headers
      const buf2 = new Uint8Array(51 * 2)
      buf2.set(v2Header, 0)
      buf2.set(v2Header, 51)
      await assert.isRejected(CarReader.fromBytes(buf2), Error, 'Invalid CAR version: 2 (expected 1)')
    })
  })
})
