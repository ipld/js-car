/* eslint-env mocha */

import assert from 'assert'
import path from 'path'
import multiformats from 'multiformats/basics.js'
import { acid, makeData, verifyBlocks, verifyHas, verifyRoots } from './fixture-data.js'
import dagCbor from '@ipld/dag-cbor'
import base58 from 'multiformats/bases/base58.js'
import Car from '../car.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

multiformats.add(dagCbor)
multiformats.multibase.add(base58)
const { readFileComplete } = Car(multiformats)

let rawBlocks

describe('Read File', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
  })

  it('read existing', async () => {
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await verifyHas(carDs)
    await verifyBlocks(carDs)
    await verifyRoots(carDs)
    await assert.rejects(carDs.get(rawBlocks[3].cid)) // doesn't exist
    await carDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await verifyRoots(carDs)
    await carDs.close()
  })

  // when we instantiate from a File, CarDatastore should be immutable
  it('immutable', async () => {
    const carDs = await readFileComplete(path.join(__dirname, 'go.car'))
    await assert.rejects(carDs.put(acid, Buffer.from('blip')))
    await assert.rejects(carDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(carDs.setRoots(acid))
    await assert.rejects(carDs.setRoots([acid]))
  })
})
