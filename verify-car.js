#!/usr/bin/env node

// Verify a car file's blocks have round-tripishness
import fs from 'fs'
import multiformats from 'multiformats/basics'
import car from 'datastore-car'
import dagCbor from '@ipld/dag-cbor'
import blake from '../../multiformats/js-multihashing/src/blake.js'

if (!process.argv[2]) {
  console.log('Usage: verify-car.js <path/to/car>')
  process.exit(1)
}

multiformats.add(dagCbor)

// for filecoin
const blake2b = (() => {
  const table = {}
  blake.addFuncs(table)
  const B = table[0xb220]
  return (bin) => B().update(bin).digest()
})()

multiformats.multihash.add({
  name: 'blake2b-256',
  encode: blake2b,
  code: 0xb220
})

const CarDatastore = car(multiformats)

function toHex (b) {
  return b.reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '')
}

async function example () {
  const inStream = fs.createReadStream(process.argv[2])
  const readDs = await CarDatastore.readStreaming(inStream)
  let count = 0
  for await (const { key, value } of readDs.query()) {
    const cid = multiformats.CID.from(key)
    const obj = multiformats.decode(value, cid.code)
    const reenc = multiformats.encode(obj, cid.code)
    const hashFn = multiformats.multihash.decode(cid.multihash).code
    const mh = await multiformats.multihash.hash(reenc, hashFn)
    const recid = multiformats.CID.create(1, cid.code, mh)
    if (!recid.equals(cid)) {
      console.log(`\nMismatch: ${cid} <> ${recid}`)
      console.log(`Orig:\n${toHex(value)}\nRe-encode:\n${toHex(reenc)}`)
    } else {
      if (count++ % 100 === 0) {
        process.stdout.write('.')
      }
    }
  }
  await readDs.close()
}

example().catch((err) => {
  console.error(err)
  process.exit(1)
})
