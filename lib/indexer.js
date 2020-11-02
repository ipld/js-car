import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').RootsReader} RootsReader
 * @typedef {import('../api').BlockIndex} BlockIndex
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {RootsReader}
 * @implements {AsyncIterable<BlockIndex>}
 * @property {number} version
 */
export default class CarIndexer {
  /**
   * @param {number} version
   * @param {CID[]} roots
   * @param {AsyncGenerator<BlockIndex>} iterator
   */
  constructor (version, roots, iterator) {
    this._version = version
    this._roots = roots
    this._iterator = iterator
  }

  get version () {
    return this._version
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

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<CarIndexer>}
   */
  static async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeIndexerComplete(bytesReader(bytes))
  }

  /**
   * @param {AsyncIterable<Uint8Array>} asyncIterable
   * @returns {Promise<CarIndexer>}
   */
  static async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeIndexerComplete(asyncIterableReader(asyncIterable))
  }
}

/**
 * @private
 * @param {BytesReader} reader
 * @returns {Promise<CarIndexer>}
 */
async function decodeIndexerComplete (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()

  return new CarIndexer(version, roots, decoder.blocksIndex())
}
