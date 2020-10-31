import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockIterator} BlockIterator
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {BlockIterator}
 */
class CarIterator {
  /**
   * @param {number} version
   * @param {CID[]} roots
   * @param {AsyncIterable<Block>|void} iterable
   */
  constructor (version, roots, iterable) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._iterable = iterable
    this._decoded = false
  }

  /**
   * @returns {Promise<CID[]>}
   */
  async getRoots () {
    return this._roots
  }

  /**
   * @returns {AsyncGenerator<Block>}
   */
  async * blocks () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    /* c8 ignore next 3 */
    if (!this._iterable) {
      throw new Error('Block iterable not found')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block
    }
  }

  /**
   * @returns {AsyncGenerator<CID>}
   */
  async * cids () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    /* c8 ignore next 3 */
    if (!this._iterable) {
      throw new Error('Block iterable not found')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block.cid
    }
  }
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<BlockIterator>}
 */
async function decodeIterator (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  return new CarIterator(version, roots, decoder.blocks())
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<BlockIterator>}
 */
async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeIterator(bytesReader(bytes))
}

/**
 * @param {AsyncIterable<Uint8Array>} asyncIterable
 * @returns {Promise<BlockIterator>}
 */
async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeIterator(asyncIterableReader(asyncIterable))
}

CarIterator.fromBytes = fromBytes
CarIterator.fromIterable = fromIterable

export { CarIterator, fromBytes, fromIterable }
