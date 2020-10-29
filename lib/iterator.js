import {
  decodeIterator,
  asyncIterableReader,
  bytesReader
} from './decoder.js'

const CarIterator = {
  async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeIterator(bytesReader(bytes))
  },

  async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeIterator(asyncIterableReader(asyncIterable))
  }
}

export default CarIterator
