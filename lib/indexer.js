import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockIndex} BlockIndex
 * @typedef {import('../api').RootsReader} RootsReader
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {RootsReader}
 * @implements {AsyncIterable<BlockIndex>}
 * implements {CarIndexer}
 */
class CarIndexer {
  /**
   * @param {number} version
   * @param {CID[]} roots
   * @param {AsyncGenerator<BlockIndex>} iterator
   */
  constructor (version, roots, iterator) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._iterator = iterator
  }

  /**
   * @returns {Promise<CID[]>}
   */
  async getRoots () {
    return this._roots
  }

  /**
   * @returns {AsyncIterator<BlockIndex>}
   */
  [Symbol.asyncIterator] () {
    return this._iterator
  }
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<CarIndexer>}
 */
async function decodeIndexerComplete (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()

  return new CarIndexer(version, roots, decoder.blocksIndex())
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<CarIndexer>}
 */
async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeIndexerComplete(bytesReader(bytes))
}
/**
 * @param {AsyncIterable<Uint8Array>} asyncIterable
 * @returns {Promise<CarIndexer>}
 */
async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeIndexerComplete(asyncIterableReader(asyncIterable))
}

CarIndexer.fromBytes = fromBytes
CarIndexer.fromIterable = fromIterable

export { CarIndexer, fromBytes, fromIterable }
