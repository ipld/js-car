#!/usr/bin/env node

import fs from 'fs'
import { CarIterator } from '@ipld/car'
import * as dagCbor from '@ipld/dag-cbor'
import * as dagPb from '@ipld/dag-pb'
import * as dagJson from '@ipld/dag-json'
import raw from 'multiformats/codecs/raw'
import json from 'multiformats/codecs/json'

if (!process.argv[2]) {
  console.log('Usage: example-dump-car.js <path/to/car>')
  process.exit(1)
}

const codecs = {
  [dagCbor.code]: dagCbor,
  [dagPb.code]: dagPb,
  [dagJson.code]: dagJson,
  [raw.code]: raw,
  [json.code]: json
}

function decode (cid, bytes) {
  if (!codecs[cid.code]) {
    throw new Error(`Unknown codec code: 0x${cid.code.toString(16)}`)
  }
  return codecs[cid.code].decode(bytes)
}

async function run () {
  const inStream = fs.createReadStream(process.argv[2])
  const reader = await CarIterator.fromIterable(inStream)
  for await (const { cid, bytes } of reader.blocks()) {
    await fs.promises.writeFile(cid.toString(), bytes)

    const decoded = decode(cid, bytes)
    console.log(`${cid} [${codecs[cid.code].name}]`)
    console.dir(new TextDecoder().decode(dagJson.encode(decoded)))
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
