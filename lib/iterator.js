import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').CarIterator} CarIterator
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {CarIterator}
 */
export class CarIteratorBase {
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

export default class Iterator extends CarIteratorBase {
  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<Iterator>}
   */
  static async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeIterator(bytesReader(bytes))
  }

  /**
   * @param {AsyncIterable<Uint8Array>} asyncIterable
   * @returns {Promise<Iterator>}
   */
  static async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeIterator(asyncIterableReader(asyncIterable))
  }
}

/**
 * @private
 * @param {BytesReader} reader
 * @returns {Promise<Iterator>}
 */
async function decodeIterator (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  return new Iterator(version, roots, decoder.blocks())
}
