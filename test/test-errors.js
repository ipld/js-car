/* eslint-env mocha */

import assert from 'assert'
import { promises as fs } from 'fs'
import path from 'path'
import multiformats from 'multiformats/basics'
import { acid, car } from './fixture-data.js'
import dagCbor from '@ipld/dag-cbor'
import Car from 'datastore-car'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

multiformats.add(dagCbor)
const { readBuffer, readFileComplete, writeStream } = Car(multiformats)

describe('Errors', () => {
  it('unimplemented methods', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.batch())
    await assert.rejects(carDs.batch('foo'))
    await carDs.close()
  })

  it('bad gets', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.get('blip'), /only accepts CIDs or CID strings/) // not a CID key
    await assert.rejects(carDs.get(null)) // not a CID key
    await assert.doesNotReject(carDs.get(acid)) // sanity check
    await carDs.close()
  })

  it('bad has\'', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.has('blip'), /only accepts CIDs or CID strings/) // not a CID key
    await assert.doesNotReject(carDs.has(acid)) // sanity check
    await carDs.close()
  })

  it('bad queries', async () => {
    const carDs = await readBuffer(car)
    assert.throws(() => carDs.query('blip'))
    assert.throws(() => carDs.query(false))
    assert.throws(() => carDs.query(null))
    await carDs.close()
  })

  it('bad root type', async () => {
    const carDs = await writeStream(fs.createWriteStream('test.car'))
    assert.rejects(carDs.setRoots('blip'))
    assert.rejects(carDs.setRoots(['blip']))
    assert.rejects(carDs.setRoots([acid, false]))
    await carDs.close()
  })

  it('bad puts', async () => {
    const carDs = await writeStream(fs.createWriteStream('test.car'))
    await assert.rejects(carDs.put(acid, 'blip')) // not a Uint8Array value
    await assert.rejects(carDs.put('blip', new TextEncoder().encode('blip')), /only accepts CIDs or CID strings/) // not a CID key
    await carDs.close()
  })

  it('truncated file', async () => {
    const data = await fs.readFile(path.join(__dirname, 'go.car'))
    await fs.writeFile('test.car', data.slice(0, data.length - 5))
    await assert.rejects(readFileComplete('test.car'), {
      name: 'Error',
      message: 'Unexpected end of file'
    })
  })

  after(async () => {
    return fs.unlink('test.car').catch(() => {})
  })
})
