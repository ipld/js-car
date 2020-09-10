import {
  decodeComplete,
  asyncIterableReader,
  bytesReader
} from './lib/decoder.js'

function CarReader (multiformats) {
  return {
    async fromBytes (bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('fromBytes() requires a Uint8Array')
      }
      return decodeComplete(multiformats, bytesReader(bytes))
    },

    async fromIterable (asyncIterable) {
      if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
        throw new TypeError('fromIterable() requires an async iterable')
      }
      return decodeComplete(multiformats, asyncIterableReader(asyncIterable))
    }
  }
}

export {
  CarReader
}
