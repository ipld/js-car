#!/usr/bin/env node

// This example requires these additional dependencies:
//   - @ipld/dag-pb
//   - @ipld/dag-json
// And needs to be run as a "module" which either means a package.json with
//   `"type": "module"`
// or the file needs to be renamed `example.mjs`.

// Example: verify a car file's blocks have round-tripishness.
// This example is overly verbose but illustrates some concepts involved in CAR
// files.

import fs from 'fs'
import { bytes, CID } from 'multiformats'
import { CarBlockIterator } from '@ipld/car/iterator'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagPb from '@ipld/dag-pb'
import * as dagJson from '@ipld/dag-json'
import * as raw from 'multiformats/codecs/raw'
import * as json from 'multiformats/codecs/json'
import { sha256 } from 'multiformats/hashes/sha2'
import { from as hasher } from 'multiformats/hashes/hasher'
import { blake2b256 } from '@multiformats/blake2/blake2b'

const { toHex } = bytes

if (!process.argv[2]) {
  console.log('Usage: verify-car.js <path/to/car>')
  process.exit(1)
}

const codecs = {
  [dagCbor.code]: dagCbor,
  [dagPb.code]: dagPb,
  [dagJson.code]: dagJson,
  [raw.code]: raw,
  [json.code]: json
}

const hashes = {
  [sha256.code]: sha256,
  [blake2b256.code]: hasher(blake2b256)
}

async function run () {
  const inStream = fs.createReadStream(process.argv[2])
  const reader = await CarBlockIterator.fromIterable(inStream)
  let count = 0
  for await (const { bytes, cid } of reader) {
    if (!codecs[cid.code]) {
      console.log(`Unexpected codec: 0x${cid.code.toString(16)}`)
      process.exit(1)
    }
    if (!hashes[cid.multihash.code]) {
      console.log(`Unexpected multihash code: 0x${cid.multihash.code.toString(16)}`)
      process.exit(1)
    }

    // round-trip the object and make a new CID for it
    const obj = codecs[cid.code].decode(bytes)
    const reenc = codecs[cid.code].encode(obj)
    const hash = await hashes[cid.multihash.code].digest(bytes)
    const recid = CID.create(cid.version, cid.code, hash)

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
