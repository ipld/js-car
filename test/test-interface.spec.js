/* eslint-env mocha */
import * as car from '../src/index.js'
import { CarIndexer } from '../src/indexer.js'
import { CarBlockIterator, CarCIDIterator } from '../src/iterator.js'
import { CarReader, __browser } from '../src/reader.js'
import { CarWriter } from '../src/writer.js'
import { assert } from './common.js'

// simple sanity check that our main exports match the direct exports
describe('Interface', () => {
  it('exports match', () => {
    assert.strictEqual(car.CarReader, CarReader)
    assert.strictEqual(car.CarIndexer, CarIndexer)
    assert.strictEqual(car.CarBlockIterator, CarBlockIterator)
    assert.strictEqual(car.CarCIDIterator, CarCIDIterator)
    assert.strictEqual(car.CarWriter, CarWriter)
  })

  it('browser exports', () => {
    // @ts-ignore
    assert.strictEqual(__browser, globalThis.process === undefined)
  })
})
