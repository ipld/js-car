import {
  decodeIndexerComplete,
  asyncIterableReader,
  bytesReader
} from './decoder.js'

const CarIndexer = {
  async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeIndexerComplete(bytesReader(bytes))
  },

  async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeIndexerComplete(asyncIterableReader(asyncIterable))
  }
}

export default CarIndexer
