/* eslint-env mocha */

const fs = require('fs').promises
const path = require('path')
const assert = require('assert')
const { readBuffer, readFileComplete, writeStream } = require('../')
const { acid, car } = require('./fixture-data')

describe('Errors', () => {
  it('unimplemented methods', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.batch())
    await assert.rejects(carDs.batch('foo'))
    await carDs.close()
  })

  it('bad gets', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.get('blip')) // not a CID key
    await assert.doesNotReject(carDs.get(acid)) // sanity check
    await carDs.close()
  })

  it('bad has\'', async () => {
    const carDs = await readBuffer(car)
    await assert.rejects(carDs.has('blip')) // not a CID key
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
    await assert.rejects(carDs.put(acid, 'blip')) // not a Buffer value
    await assert.rejects(carDs.put('blip', Buffer.from('blip'))) // not a CID key
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
