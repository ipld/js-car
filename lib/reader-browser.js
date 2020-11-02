import { asyncIterableReader, bytesReader, createDecoder } from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').RootsReader} RootsReader
 * @typedef {import('../api').BlockReader} BlockReader
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {RootsReader}
 * @implements {BlockReader}
 */
export default class CarReader {
  /**
   * @param {number} version
   * @param {CID[]} roots
   * @param {Block[]} blocks
   */
  constructor (version, roots, blocks) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._blocks = blocks
    this._keys = blocks.map((b) => b.cid.toString())
  }

  /**
   * @returns {Promise<CID[]>}
   */
  async getRoots () {
    return this._roots
  }

  /**
   * @param {CID} key
   * @returns {Promise<boolean>}
   */
  async has (key) {
    return this._keys.indexOf(key.toString()) > -1
  }

  /**
   * @param {CID} key
   * @returns {Promise<Block | undefined>}
   */
  async get (key) {
    const index = this._keys.indexOf(key.toString())
    return index > -1 ? this._blocks[index] : undefined
  }

  /**
   * @returns {AsyncGenerator<Block>}
   */
  async * blocks () {
    for (const block of this._blocks) {
      yield block
    }
  }

  /**
   * @returns {AsyncGenerator<CID>}
   */
  async * cids () {
    for (const block of this._blocks) {
      yield block.cid
    }
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<CarReader>}
   */
  static async fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }
    return decodeReaderComplete(bytesReader(bytes))
  }

  /**
   * @param {AsyncIterable<Uint8Array>} asyncIterable
   * @returns {Promise<CarReader>}
   */
  static async fromIterable (asyncIterable) {
    if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
      throw new TypeError('fromIterable() requires an async iterable')
    }
    return decodeReaderComplete(asyncIterableReader(asyncIterable))
  }
}

/**
 * @private
 * @param {BytesReader} reader
 * @returns {Promise<CarReader>}
 */
async function decodeReaderComplete (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  const blocks = []
  for await (const block of decoder.blocks()) {
    blocks.push(block)
  }

  return new CarReader(version, roots, blocks)
}

export const __browser = true
