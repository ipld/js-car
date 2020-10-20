import { CID } from 'multiformats'
import {
  decodeReaderComplete,
  decodeIndexerComplete,
  decodeIterator,
  asyncIterableReader,
  bytesReader
} from './lib/decoder.js'
import { encodeWriter } from './lib/encoder.js'

const CarReader = {
  async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeReaderComplete(bytesReader(bytes))
  },

  async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeReaderComplete(asyncIterableReader(asyncIterable))
  }
}

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

function toRoots (roots) {
  if (roots && roots.asCID === roots) {
    roots = [roots]
  }
  if (roots === undefined) {
    roots = []
  }
  if (!Array.isArray(roots)) {
    throw new TypeError('roots must be a single CID or an array of CIDs')
  }
  const _roots = []
  for (const root of roots) {
    const _root = CID.asCID(root)
    if (!_root) {
      throw new TypeError('roots must be a single CID or an array of CIDs')
    }
    _roots.push(_root)
  }
  return _roots
}

const CarWriter = {
  create (roots) {
    return encodeWriter(toRoots(roots))
  }
}

export {
  CarReader,
  CarIndexer,
  CarIterator,
  CarWriter
}
