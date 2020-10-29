/* eslint-env mocha */
import * as car from '@ipld/car'
import CarReader from '@ipld/car/reader'
import CarIndexer from '@ipld/car/indexer'
import CarIterator from '@ipld/car/iterator'
import CarWriter from '@ipld/car/writer'

import { assert } from './common.js'

describe('Interface', () => {
  it('exports match', () => {
    assert.ok(car.CarReader === CarReader)
    assert.ok(car.CarIndexer === CarIndexer)
    assert.ok(car.CarIterator === CarIterator)
    assert.ok(car.CarWriter === CarWriter)
  })
})
