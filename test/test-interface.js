/* eslint-env mocha */
import * as car from '@ipld/car'
import {
  CarReader,
  fromBytes as readerFromBytes,
  fromIterable as readerFromIterable,
  __browser
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
    assert.strictEqual(car.CarReader, CarReader)
    assert.strictEqual(CarReader.fromBytes, readerFromBytes)
    assert.strictEqual(CarReader.fromIterable, readerFromIterable)

    assert.strictEqual(car.CarIndexer, CarIndexer)
    assert.strictEqual(CarIndexer.fromBytes, indexerFromBytes)
    assert.strictEqual(CarIndexer.fromIterable, indexerFromIterable)

    assert.strictEqual(car.CarIterator, CarIterator)
    assert.strictEqual(CarIterator.fromBytes, iteratorFromBytes)
    assert.strictEqual(CarIterator.fromIterable, iteratorFromIterable)

    assert.strictEqual(car.CarWriter, CarWriter)
    assert.strictEqual(car.CarWriterOut, CarWriterOut)
    assert.strictEqual(CarWriter.create, writerCreate)
  })

  it('browser exports', () => {
    // @ts-ignore
    assert.strictEqual(__browser, !!process.browser)
  })
})
