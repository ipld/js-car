/* eslint-env mocha */
import * as car from '@ipld/car'
import CarReader, { __browser } from '@ipld/car/reader'
import CarIndexer from '@ipld/car/indexer'
import CarIterator from '@ipld/car/iterator'
import CarWriter from '@ipld/car/writer'

import { assert } from './common.js'

// simple sanity check that our main exports match the direct exports
describe('Interface', () => {
  it('exports match', () => {
    assert.strictEqual(car.CarReader, CarReader)
    assert.strictEqual(car.CarIndexer, CarIndexer)
    assert.strictEqual(car.CarIterator, CarIterator)
    assert.strictEqual(car.CarWriter, CarWriter)
  })

  it('browser exports', () => {
    // @ts-ignore
    assert.strictEqual(__browser, !!process.browser)
  })
})
