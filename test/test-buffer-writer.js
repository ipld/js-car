/* eslint-env mocha */

import * as CarBufferWriter from '@ipld/car/buffer-writer'
import { CarReader } from '@ipld/car/reader'
import { createHeader } from '../lib/encoder.js'
import { assert } from './common.js'
import { CID, varint } from 'multiformats'
import * as CBOR from '@ipld/dag-cbor'
import { sha256, sha512 } from 'multiformats/hashes/sha2'
import { identity } from 'multiformats/hashes/identity'
import * as Raw from 'multiformats/codecs/raw'
import * as Block from 'multiformats/block'

describe('CarBufferWriter', () => {
  const cid = CID.parse('bafkreifuosuzujyf4i6psbneqtwg2fhplc2wxptc5euspa2gn3bwhnihfu')
  describe('calculateHeaderLength', async () => {
    for (const count of [0, 1, 10, 18, 24, 48, 124, 255, 258, 65536 - 1, 65536]) {
      it(`calculateHeaderLength(new Array(${count}).fill(36))`, () => {
        const roots = new Array(count).fill(cid)
        const sizes = new Array(count).fill(cid.bytes.byteLength)
        assert.deepEqual(
          CarBufferWriter.calculateHeaderLength(sizes),
          createHeader(roots).byteLength
        )
      })
      it(`calculateHeaderLength(new Array(${count}).fill(36))`, () => {
        const roots = new Array(count).fill(cid)
        const rootLengths = roots.map((c) => c.bytes.byteLength)
        assert.deepEqual(CarBufferWriter.calculateHeaderLength(rootLengths), createHeader(roots).byteLength)
      })
    }
    it('estimate on large CIDs', () => {
      const largeCID = CID.parse(`bafkqbbac${'a'.repeat(416)}`)
      assert.equal(
        CarBufferWriter.calculateHeaderLength([
          cid.bytes.byteLength,
          largeCID.bytes.byteLength
        ]),
        createHeader([
          cid,
          largeCID
        ]).byteLength
      )
    })

    it('estimate on large CIDs 2', () => {
      const largeCID = CID.createV1(Raw.code, identity.digest(new Uint8Array(512).fill(1)))
      assert.equal(
        CarBufferWriter.calculateHeaderLength([
          cid.bytes.byteLength,
          largeCID.bytes.byteLength
        ]),
        createHeader([cid, largeCID]).byteLength
      )
    })
  })

  describe('writer', () => {
    it('estimate header and write blocks', async () => {
      const headerSize = CarBufferWriter.estimateHeaderLength(1)
      const dataSize = 256
      const buffer = new ArrayBuffer(headerSize + dataSize)
      const writer = CarBufferWriter.createWriter(buffer, { headerSize })
      const b1 = await Block.encode({
        value: { hello: 'world' },
        codec: CBOR,
        hasher: sha256
      })

      writer.write(b1)

      const b2 = await Block.encode({
        value: { bye: 'world' },
        codec: CBOR,
        hasher: sha256
      })
      writer.write(b2)

      writer.addRoot(b1.cid)
      const bytes = writer.close()

      const reader = await CarReader.fromBytes(bytes)
      assert.deepEqual(await reader.getRoots(), [b1.cid])
      assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
    })

    it('overestimate header', async () => {
      const headerSize = CarBufferWriter.estimateHeaderLength(2)
      const dataSize = 256
      const buffer = new ArrayBuffer(headerSize + dataSize)
      const writer = CarBufferWriter.createWriter(buffer, { headerSize })
      const b1 = await Block.encode({
        value: { hello: 'world' },
        codec: CBOR,
        hasher: sha256
      })

      writer.write(b1)

      const b2 = await Block.encode({
        value: { bye: 'world' },
        codec: CBOR,
        hasher: sha256
      })
      writer.write(b2)

      writer.addRoot(b1.cid)
      assert.throws(() => writer.close(), /Header size was overestimate/)
      const bytes = writer.close({ resize: true })

      const reader = await CarReader.fromBytes(bytes)
      assert.deepEqual(await reader.getRoots(), [b1.cid])
      assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
    })

    it('underestimate header', async () => {
      const headerSize = CarBufferWriter.estimateHeaderLength(2)
      const dataSize = 300
      const buffer = new ArrayBuffer(headerSize + dataSize)
      const writer = CarBufferWriter.createWriter(buffer, { headerSize })
      const b1 = await Block.encode({
        value: { hello: 'world' },
        codec: CBOR,
        hasher: sha256
      })

      writer.write(b1)
      writer.addRoot(b1.cid)

      const b2 = await Block.encode({
        value: { bye: 'world' },
        codec: CBOR,
        hasher: sha512
      })
      writer.write(b2)
      assert.throws(() => writer.addRoot(b2.cid), /has no capacity/)
      writer.addRoot(b2.cid, { resize: true })

      const bytes = writer.close()

      const reader = await CarReader.fromBytes(bytes)
      assert.deepEqual(await reader.getRoots(), [b1.cid, b2.cid])
      assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
    })
  })

  it('has no space for the root', async () => {
    const headerSize = CarBufferWriter.estimateHeaderLength(1)
    const dataSize = 100
    const buffer = new ArrayBuffer(headerSize + dataSize)
    const writer = CarBufferWriter.createWriter(buffer, { headerSize })
    const b1 = await Block.encode({
      value: { hello: 'world' },
      codec: CBOR,
      hasher: sha256
    })

    writer.write(b1)
    writer.addRoot(b1.cid)

    const b2 = await Block.encode({
      value: { bye: 'world' },
      codec: CBOR,
      hasher: sha256
    })
    writer.write(b2)
    assert.throws(() => writer.addRoot(b2.cid), /Buffer has no capacity for a new root/)
    assert.throws(() => writer.addRoot(b2.cid, { resize: true }), /Buffer has no capacity for a new root/)

    const bytes = writer.close()

    const reader = await CarReader.fromBytes(bytes)
    assert.deepEqual(await reader.getRoots(), [b1.cid])
    assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
  })

  it('has no space for the block', async () => {
    const headerSize = CarBufferWriter.estimateHeaderLength(1)
    const dataSize = 58
    const buffer = new ArrayBuffer(headerSize + dataSize)
    const writer = CarBufferWriter.createWriter(buffer, { headerSize })
    const b1 = await Block.encode({
      value: { hello: 'world' },
      codec: CBOR,
      hasher: sha256
    })

    writer.write(b1)
    writer.addRoot(b1.cid)

    const b2 = await Block.encode({
      value: { bye: 'world' },
      codec: CBOR,
      hasher: sha256
    })
    assert.throws(() => writer.write(b2), /Buffer has no capacity for this block/)

    const bytes = writer.close()

    const reader = await CarReader.fromBytes(bytes)
    assert.deepEqual(await reader.getRoots(), [b1.cid])
    assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }])
  })

  it('provide roots', async () => {
    const b1 = await Block.encode({
      value: { hello: 'world' },
      codec: CBOR,
      hasher: sha256
    })
    const b2 = await Block.encode({
      value: { bye: 'world' },
      codec: CBOR,
      hasher: sha512
    })

    const buffer = new ArrayBuffer(300)
    const writer = CarBufferWriter.createWriter(buffer, { roots: [b1.cid, b2.cid] })

    writer.write(b1)
    writer.write(b2)

    const bytes = writer.close()

    const reader = await CarReader.fromBytes(bytes)
    assert.deepEqual(await reader.getRoots(), [b1.cid, b2.cid])
    assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
  })

  it('provide large CID root', async () => {
    const bytes = new Uint8Array(512).fill(1)
    const b1 = await Block.encode({
      value: { hello: 'world' },
      codec: CBOR,
      hasher: sha256
    })

    const b2 = {
      cid: CID.createV1(Raw.code, identity.digest(bytes)),
      bytes
    }

    const headerSize = CBOR.encode({ version: 1, roots: [b1.cid, b2.cid] }).byteLength
    const bodySize = CarBufferWriter.blockLength(b1) + CarBufferWriter.blockLength(b2)
    const varintSize = varint.encodingLength(headerSize)

    const writer = CarBufferWriter.createWriter(new ArrayBuffer(varintSize + headerSize + bodySize), { roots: [b1.cid, b2.cid] })

    writer.write(b1)
    writer.write(b2)
    const car = writer.close()
    const reader = await CarReader.fromBytes(car)
    assert.deepEqual(await reader.getRoots(), [b1.cid, b2.cid])
    assert.deepEqual(reader._blocks, [{ cid: b1.cid, bytes: b1.bytes }, { cid: b2.cid, bytes: b2.bytes }])
  })
})
