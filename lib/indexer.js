import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

class CarIndexer {
  constructor (version, roots, indexData) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._indexData = indexData
  }

  async getRoots () {
    return this._roots
  }

  [Symbol.asyncIterator] () {
    const indexData = this._indexData.slice()
    return {
      async next () {
        if (!indexData.length) {
          return { done: true }
        }
        return { done: false, value: indexData.shift() }
      }
    }
  }
}

async function decodeIndexerComplete (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  const indexData = []
  for await (const index of decoder.blocksIndex()) {
    indexData.push(index)
  }

  return new CarIndexer(version, roots, indexData)
}

async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeIndexerComplete(bytesReader(bytes))
}

async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeIndexerComplete(asyncIterableReader(asyncIterable))
}

CarIndexer.fromBytes = fromBytes
CarIndexer.fromIterable = fromIterable

export { CarIndexer, fromBytes, fromIterable }
