#!/usr/bin/env node

import fs from 'fs/promises'
import { Readable } from 'stream'
import { CarReader, CarWriter } from '@ipld/car'
import * as raw from 'multiformats/codecs/raw'
import * as dagCbor from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import varint from 'varint'
import bl from 'bl'

async function example () {
  /** WRITE **/
  {
    // create a CARv1 payload, just a single block
    const bytes = new TextEncoder().encode('random meaningless bytes')
    const hash = await sha256.digest(raw.encode(bytes))
    const cid = CID.create(1, raw.code, hash)
    const { writer, out } = await CarWriter.create([cid])
    const v1Payload = bl()
    Readable.from(out).pipe(v1Payload)
    await writer.put({ cid, bytes })
    await writer.close()

    // _the_ CARv2 pragma, 11 bytes - a fake CARv1-like header that says {version:2}
    const v2Pragma = new Uint8Array([10, 161, 103, 118, 101, 114, 115, 105, 111, 110, 2])
    // sneaky message in CARv2 wrapper
    const msg = dagCbor.encode({ sneaky: 'sending a message outside of CARv1 payload', expectedRoot: cid })
    const msgLength = new Uint8Array(varint.encode(msg.byteLength))
    /* v2 header is 40 bytes - characteristics: 16, v1 offset: 8, v1 size: 8, index offset: 8 */
    const v2Data = new Uint8Array(v2Pragma.byteLength + 40 + msgLength.byteLength + msg.byteLength + v1Payload.length)
    v2Data.set(v2Pragma, 0)
    // characteristics are the first 16 bytes after the pragma, the leftmost bit means
    // "is fully indexed", so we're using the 2nd to leftmost bit set to indicate
    // "message after v2 header" (TODO: codify this)
    let off = v2Pragma.byteLength
    v2Data[off] = (1 << 6)
    const dv = new DataView(v2Data.buffer, v2Data.byteOffset, v2Data.byteLength)
    off += 16 // characteristics
    // where is the v1 payload?
    const dataOffset = v2Pragma.byteLength + 40 + msgLength.byteLength + msg.byteLength
    dv.setBigUint64(off, BigInt(dataOffset), true) // position 16 is "data offset"
    off += 8
    dv.setBigUint64(off, BigInt(v1Payload.length), true) // position 16+8 is "data size"
    off += 8
    // position 16+8+8 is "index offset", leaving it as zero says "no index"
    off += 8

    v2Data.set(msgLength, off)
    off += msgLength.byteLength
    v2Data.set(msg, off)
    off += msg.byteLength
    v2Data.set(v1Payload.slice(), off)

    await fs.writeFile('example-messaging.car', v2Data)
  }

  /** READ **/
  {
    const inputBytes = await fs.readFile('example-messaging.car')
    const reader = await CarReader.fromBytes(inputBytes)

    // read the CARv1 contents as normal
    const roots = await reader.getRoots()
    const got = await reader.get(roots[0])

    console.log('Retrieved [%s] from example-messaging.car with CID [%s]',
      new TextDecoder().decode(got.bytes),
      roots[0].toString())

    // BUT, our sneaky message is in here too
    console.log('Is CARv2?', reader._header.version === 2)
    console.log('Has message?', (reader._header.characteristics[0] & (1n << 6n)) !== 0)
    let off = /* pragma */ 11 + /* header */ 40
    const msgLength = varint.decode(inputBytes.slice(off))
    console.log('Message length:', msgLength)
    off += varint.decode.bytes
    const msgBytes = inputBytes.slice(off, off + msgLength)
    const msg = dagCbor.decode(msgBytes)
    console.log('Message:', msg)
  }
}

example().catch((err) => {
  console.error(err)
  process.exit(1)
})
