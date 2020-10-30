/* eslint-env mocha */
import * as car from '@ipld/car'
import {
  CarReader,
  fromBytes as readerFromBytes,
  fromIterable as readerFromIterable
} from '@ipld/car/reader'
import {
  CarIndexer,
  fromBytes as indexerFromBytes,
  fromIterable as indexerFromIterable
} from '@ipld/car/indexer'
import {
  CarIterator,
  fromBytes as iteratorFromBytes,
  fromIterable as iteratorFromIterable
} from '@ipld/car/iterator'
import { CarWriter, CarWriterOut, create as writerCreate } from '@ipld/car/writer'

import { assert } from './common.js'

// simple sanity check that our main exports match the direct exports
describe('Interface', () => {
  it('exports match', () => {
    assert.ok(car.CarReader === CarReader)
    assert.ok(CarReader.fromBytes === readerFromBytes)
    assert.ok(CarReader.fromIterable === readerFromIterable)

    assert.ok(car.CarIndexer === CarIndexer)
    assert.ok(CarIndexer.fromBytes === indexerFromBytes)
    assert.ok(CarIndexer.fromIterable === indexerFromIterable)

    assert.ok(car.CarIterator === CarIterator)
    assert.ok(CarIterator.fromBytes === iteratorFromBytes)
    assert.ok(CarIterator.fromIterable === iteratorFromIterable)

    assert.ok(car.CarWriter === CarWriter)
    assert.ok(car.CarWriterOut === CarWriterOut)
    assert.ok(CarWriter.create === writerCreate)
  })
})
