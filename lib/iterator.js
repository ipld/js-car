import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

class CarIterator {
  constructor (version, roots, iterable) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._iterable = iterable
    this._decoded = false
  }

  async getRoots () {
    return this._roots
  }

  async * blocks () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block
    }
  }

  async * cids () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block.cid
    }
  }
}

async function decodeIterator (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  return new CarIterator(version, roots, decoder.blocks())
}

async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeIterator(bytesReader(bytes))
}

async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeIterator(asyncIterableReader(asyncIterable))
}

CarIterator.fromBytes = fromBytes
CarIterator.fromIterable = fromIterable

export { CarIterator, fromBytes, fromIterable }
