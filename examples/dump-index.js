#!/usr/bin/env node

// Take a .car file and dump its index in DAG-JSON format, one line per block

import fs from 'fs'
import { CarIndexer } from '@ipld/car/indexer'
import * as dagJson from '@ipld/dag-json'

if (!process.argv[2]) {
  console.log('Usage: dump-index.js <path/to/car>')
  process.exit(1)
}

async function run () {
  const indexer = await CarIndexer.fromIterable(fs.createReadStream(process.argv[2]))
  for await (const blockIndex of indexer) {
    console.log(new TextDecoder().decode(dagJson.encode(blockIndex)))
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
