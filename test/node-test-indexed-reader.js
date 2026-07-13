/* eslint-env mocha */

import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { encode as cbEncode } from '@ipld/dag-cbor'
import { encode as vEncode } from 'varint'
import { CarIndexedReader } from '../src/indexed-reader.js'
import { assert, carBytes, goCarIndex, rndCid } from './common.js'
import {
  verifyRoots,
  verifyHas,
  verifyGet,
  verifyBlocks,
  verifyCids
} from './verify-store-reader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('CarIndexedReader fromFile()', () => {
  it('complete', async () => {
    const reader = await CarIndexedReader.fromFile(path.join(__dirname, 'go.car'))
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks(), true)
    await verifyCids(reader.cids(), true)
    // now verify the ordering is correct
    let i = 0
    for await (const block of reader.blocks()) {
      assert.strictEqual(block.cid.toString(), goCarIndex[i++].cid.toString())
    }
    i = 0
    for await (const cid of reader.cids()) {
      assert.strictEqual(cid.toString(), goCarIndex[i++].cid.toString())
    }
    assert.strictEqual(reader.version, 1)
    await reader.close()
  })

  it('bad argument', async () => {
    for (const arg of [true, false, null, undefined, Uint8Array.from([1, 2, 3]), 100, { obj: 'nope' }]) {
      // @ts-ignore
      await assert.isRejected(CarIndexedReader.fromFile(arg))
    }
  })
})

describe('CarIndexedReader fromFile() size limits', () => {
  /** @param {Uint8Array[]} chunks */
  const concatBytes = (chunks) => {
    const length = chunks.reduce((p, c) => p + c.length, 0)
    const bytes = new Uint8Array(length)
    let off = 0
    for (const chunk of chunks) {
      bytes.set(chunk, off)
      off += chunk.length
    }
    return bytes
  }
  const emptyHeader = cbEncode({ version: 1, roots: [] })
  const validV1Header = concatBytes([Uint8Array.from(vEncode(emptyHeader.length)), emptyHeader])

  /**
   * @param {Uint8Array} data
   * @returns {Promise<string>}
   */
  const writeTmp = async (data) => {
    const p = path.join(os.tmpdir(), `js-car-limits-${data.length}-${data[data.length - 1]}.car`)
    await fs.writeFile(p, data)
    return p
  }

  // Regression guard: fromFile() forwards no options here, so this only
  // passes because CarIndexer applies the default cap on its own.
  it('rejects an oversized section from the length prefix (default cap)', async () => {
    const cid = rndCid.bytes
    const section = concatBytes([Uint8Array.from(vEncode(1_000_000_000 + cid.length)), cid])
    const p = await writeTmp(concatBytes([validV1Header, section]))
    try {
      await assert.isRejected(CarIndexedReader.fromFile(p), RangeError, 'maxAllowedSectionSize')
    } finally {
      await fs.unlink(p)
    }
  })

  it('applies an explicit section-cap override through fromFile', async () => {
    const p = await writeTmp(carBytes)
    try {
      await assert.isRejected(CarIndexedReader.fromFile(p, { maxAllowedSectionSize: 0 }), RangeError, 'maxAllowedSectionSize')
    } finally {
      await fs.unlink(p)
    }
  })
})
