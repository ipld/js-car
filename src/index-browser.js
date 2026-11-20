import { CarBufferReader } from './buffer-reader.js'
import * as CarBufferWriter from './buffer-writer.js'
import { CarIndexedReader } from './indexed-reader-browser.js'
import { CarIndexer } from './indexer.js'
import { CarBlockIterator, CarCIDIterator } from './iterator.js'
import { CarReader } from './reader-browser.js'
import { CarWriter } from './writer-browser.js'

// @see https://www.iana.org/assignments/media-types/application/vnd.ipld.car
export const contentType = 'application/vnd.ipld.car'

// @see https://github.com/multiformats/multicodec/blob/912596d33fbc3a04e1b2129f39f50e1a8b9591ae/table.csv#L144
export const code = 0x0202

export {
  CarReader,
  CarIndexer,
  CarBlockIterator,
  CarCIDIterator,
  CarWriter,
  CarIndexedReader,
  CarBufferReader,
  CarBufferWriter
}
