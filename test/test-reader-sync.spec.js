/* eslint-env mocha */

import { CarBufferReader } from '../src/buffer-reader-browser.js'
import { bytesReader, readHeader } from '../src/decoder-sync.js'
import { base64 } from 'multiformats/bases/base64'
import * as dagPb from '@ipld/dag-pb'
import {
  carBytes,
  assert,
  goCarV2Bytes,
  goCarV2Roots,
  goCarV2Index,
  goCarV2Contents
} from './common.js'
import {
  verifyRoots,
  verifyHas,
  verifyGet,
  verifyBlocks,
  verifyCids
} from './verify-store-reader.js'
import { data as fixtures } from './fixtures.js'
import { expectations as fixtureExpectations } from './fixtures-expectations.js'
import { expect } from 'aegir/chai'

describe('CarReader Sync fromBytes()', () => {
  it('complete', async () => {
    const reader = CarBufferReader.fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyHas(reader)
    await verifyGet(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
    assert.strictEqual(reader.version, 1)
  })

  it('complete (get before has) switch', async () => {
    const reader = CarBufferReader.fromBytes(carBytes)
    await verifyRoots(reader)
    await verifyGet(reader)
    await verifyHas(reader)
    await verifyBlocks(reader.blocks())
    await verifyCids(reader.cids())
  })

  it('bad argument', () => {
    for (const arg of [true, false, null, undefined, 'string', 100, { obj: 'nope' }]) {
      expect(() => {
        // @ts-ignore
        CarBufferReader.fromBytes(arg)
      }).throws()
    }
  })

  it('decode error - truncated', () => {
    assert.throws(() => {
      CarBufferReader.fromBytes(carBytes.slice(0, carBytes.length - 10))
    }, Error, 'Unexpected end of data')
  })

  it('v2 complete', () => {
    const reader = CarBufferReader.fromBytes(goCarV2Bytes)
    const roots = reader.getRoots()
    assert.strictEqual(roots.length, 1)
    assert.ok(goCarV2Roots[0].equals(roots[0]))
    assert.strictEqual(reader.version, 2)
    for (const { cid } of goCarV2Index) {
      const block = reader.get(cid)
      assert.isDefined(block)
      if (block) {
        assert.ok(cid.equals(block.cid))
        let content
        if (cid.code === dagPb.code) {
          content = dagPb.decode(block.bytes)
        } else if (cid.code === 85) { // raw
          content = new TextDecoder().decode(block.bytes)
        } else {
          assert.fail('Unexpected codec')
        }
        assert.deepStrictEqual(content, goCarV2Contents[cid.toString()])
      }
    }
  })

  it('decode error - trailing null bytes', () => {
    const bytes = new Uint8Array(carBytes.length + 5)
    bytes.set(carBytes)
    try {
      CarBufferReader.fromBytes(bytes)
    } catch (/** @type {any} */ err) {
      assert.strictEqual(err.message, 'Invalid CAR section (zero length)')
      return
    }
    assert.fail('Did not throw')
  })

  it('decode error - bad first byte', () => {
    const bytes = new Uint8Array(carBytes.length + 5)
    bytes.set(carBytes)
    bytes[0] = 0
    try {
      CarBufferReader.fromBytes(bytes)
    } catch (/** @type {any} */ err) {
      assert.strictEqual(err.message, 'Invalid CAR header (zero length)')
      return
    }
    assert.fail('Did not throw')
  })
})

describe('Shared fixtures', () => {
  describe('Header', () => {
    for (const [name, { version: expectedVersion, err: expectedError }] of Object.entries(fixtureExpectations)) {
      it(name, async () => {
        const data = base64.baseDecode(fixtures[name])
        let header
        try {
          header = readHeader(bytesReader(data))
        } catch (/** @type {any} */ err) {
          if (expectedError != null) {
            assert.equal(err.message, expectedError)
            return
          }
          assert.ifError(err)
        }
        if (expectedError != null) {
          assert.fail(`Expected error: ${expectedError}`)
        }
        assert.isDefined(header, 'did not decode header')
        if (expectedVersion != null && header != null) {
          assert.strictEqual(header.version, expectedVersion)
        }
      })
    }
  })

  describe('Contents', () => {
    for (const [name, { cids: expectedCids }] of Object.entries(fixtureExpectations)) {
      if (expectedCids == null) {
        continue
      }
      it(name, async () => {
        const data = base64.baseDecode(fixtures[name])
        const reader = CarBufferReader.fromBytes(data)
        let i = 0
        for await (const cid of reader.cids()) {
          assert.strictEqual(cid.toString(), expectedCids[i++])
        }
        assert.strictEqual(i, expectedCids.length)
      })
    }
  })
})
