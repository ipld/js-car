import { CarBufferReader } from './buffer-reader.js'
import * as CarBufferWriter from './buffer-writer.js'
import { CarIndexedReader } from './indexed-reader.js'
import { CarIndexer } from './indexer.js'
import { CarBlockIterator, CarCIDIterator } from './iterator.js'
import { CarReader } from './reader.js'
import { CarWriter } from './writer.js'

// @see https://www.iana.org/assignments/media-types/application/vnd.ipld.car
export const contentType = 'application/vnd.ipld.car'

// @see: https://github.com/multiformats/multicodec/blob/696e701b6cb61f54b67a33b002201450d021f312/table.csv#L140
export const code = 0x0202

export {
  CarReader,
  CarBufferReader,
  CarIndexer,
  CarBlockIterator,
  CarCIDIterator,
  CarWriter,
  CarIndexedReader,
  CarBufferWriter
}
