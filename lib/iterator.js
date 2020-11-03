import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').RootsReader} RootsReader
 * @typedef {import('./coding').BytesReader} BytesReader
 */

/**
 * @class
 * @implements {RootsReader}
 * @property {number} version The version number of the CAR referenced by this reader (should be `1`).
 */
export class CarIteratorBase {
  /**
   * @param {number} version
   * @param {CID[]} roots
   * @param {AsyncIterable<Block>|void} iterable
   */
  constructor (version, roots, iterable) {
    this._version = version
    this._roots = roots
    this._iterable = iterable
    this._decoded = false
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
}

/**
 * Provides blockstore-like access to a CAR.
 *
 * Implements the `RootsReader` interface:
 * {@link CarReader.getRoots `getRoots()`}. And the `BlockReader` interface:
 * {@link CarReader.get `get()`}, {@link CarReader.has `has()`},
 * {@link CarReader.blocks `blocks()`} (defined as a `BlockIterator`) and
 * {@link CarReader.cids `cids()`} (defined as a `CIDIterator`).
 *
 * @name CarBlockIterator
 * @class
 * @implements {RootsReader}
 * @implements {AsyncIterable<Block>}
 */
export class CarBlockIterator extends CarIteratorBase {
  /**
   * @returns {AsyncIterator<Block>}
   */
  [Symbol.asyncIterator] () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    /* c8 ignore next 3 */
    if (!this._iterable) {
      throw new Error('Block iterable not found')
    }
    this._decoded = true
    return this._iterable[Symbol.asyncIterator]()
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<CarBlockIterator>}
   */
  static async fromBytes (bytes) {
    const { version, roots, iterator } = await fromBytes(bytes)
    return new CarBlockIterator(version, roots, iterator)
  }

  /**
   * @param {AsyncIterable<Uint8Array>} asyncIterable
   * @returns {Promise<CarBlockIterator>}
   */
  static async fromIterable (asyncIterable) {
    const { version, roots, iterator } = await fromIterable(asyncIterable)
    return new CarBlockIterator(version, roots, iterator)
  }
}

/**
 * @class
 * @implements {RootsReader}
 * @implements {AsyncIterable<CID>}
 */
export class CarCIDIterator extends CarIteratorBase {
  /**
   * @returns {AsyncIterator<CID>}
   */
  [Symbol.asyncIterator] () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    /* c8 ignore next 3 */
    if (!this._iterable) {
      throw new Error('Block iterable not found')
    }
    this._decoded = true
    const iterable = this._iterable[Symbol.asyncIterator]()
    return {
      async next () {
        const next = await iterable.next()
        if (next.done) {
          return next
        }
        return { done: false, value: next.value.cid }
      }
    }
  }

  /**
   * @param {Uint8Array} bytes
   * @returns {Promise<CarCIDIterator>}
   */
  static async fromBytes (bytes) {
    const { version, roots, iterator } = await fromBytes(bytes)
    return new CarCIDIterator(version, roots, iterator)
  }

  /**
   * @param {AsyncIterable<Uint8Array>} asyncIterable
   * @returns {Promise<CarCIDIterator>}
   */
  static async fromIterable (asyncIterable) {
    const { version, roots, iterator } = await fromIterable(asyncIterable)
    return new CarCIDIterator(version, roots, iterator)
  }
}

/**
 * @param {Uint8Array} bytes
 * @returns {Promise<{ version:number, roots:CID[], iterator:AsyncIterable<Block>}>}
 */
async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeIterator(bytesReader(bytes))
}

/**
 * @param {AsyncIterable<Uint8Array>} asyncIterable
 * @returns {Promise<{ version:number, roots:CID[], iterator:AsyncIterable<Block>}>}
 */
async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeIterator(asyncIterableReader(asyncIterable))
}

/**
 * @private
 * @param {BytesReader} reader
 * @returns {Promise<{ version:number, roots:CID[], iterator:AsyncIterable<Block>}>}
 */
async function decodeIterator (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  return { version, roots, iterator: decoder.blocks() }
}
