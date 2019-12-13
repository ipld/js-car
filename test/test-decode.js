/* eslint-env mocha */

const { promisify } = require('util')
const path = require('path')
const fs = require('fs')
fs.readFile = promisify(fs.readFile)
const { verifyDecoded } = require('./fixture-data')
const Car = require('../')

describe('Decode', () => {
  it('decodeFile', async () => {
    const decoded = await Car.decodeFile(path.join(__dirname, 'go.car'))
    return verifyDecoded(decoded)
  })

  it('decodeBuffer', async () => {
    const decoded = await Car.decodeBuffer(await fs.readFile(path.join(__dirname, 'go.car')))
    return verifyDecoded(decoded)
  })

  it('decodeStream', async () => {
    const decoded = await Car.decodeStream(fs.createReadStream(path.join(__dirname, 'go.car')))
    return verifyDecoded(decoded)
  })
})
