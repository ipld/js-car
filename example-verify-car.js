#!/usr/bin/env node

// Example: verify a car file's blocks have round-tripishness.
// This example is designed to only support DAG-CBOR codec and
// BLAKE2b-256 multihash, as used in Filecoin.

import fs from 'fs'
import { bytes, CID } from 'multiformats'
import { CarIterator } from '@ipld/car'
import * as dagCbor from '@ipld/dag-cbor'
import { blake2b256 } from '@multiformats/blake2/blake2b'

const { toHex } = bytes

if (!process.argv[2]) {
  console.log('Usage: verify-car.js <path/to/car>')
  process.exit(1)
}

async function run () {
  const inStream = fs.createReadStream(process.argv[2])
  const reader = await CarIterator.fromIterable(inStream)
  let count = 0
  for await (const { bytes, cid } of reader.blocks()) {
    if (cid.code !== dagCbor.code) {
      console.log('Unexpected codec: %d', cid.code)
      process.exit(1)
    }
    if (cid.multihash.code !== blake2b256.code) {
      console.log('Unexpected multihash code: %d', cid.multihash.code.code)
      process.exit(1)
    }

    const obj = dagCbor.decode(bytes)
    const reenc = dagCbor.encode(obj)
    const hash = await blake2b256.digest(bytes)
    const recid = CID.create(1, dagCbor.code, hash)

    if (!recid.equals(cid)) {
      console.log(`\nMismatch: ${cid} <> ${recid}`)
      console.log(`Orig:\n${toHex(bytes)}\nRe-encode:\n${toHex(reenc)}`)
    } else {
      if (count++ % 100 === 0) {
        process.stdout.write('.')
      }
    }
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
