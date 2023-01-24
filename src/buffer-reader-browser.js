import * as BufferDecoder from './buffer-decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api').Block} Block
 * @typedef {import('./api').CarBufferReader} ICarBufferReader
 * @typedef {import('./coding').CarHeader} CarHeader
 * @typedef {import('./coding').CarV2Header} CarV2Header
 */

/**
 * Provides blockstore-like access to a CAR.
 *
 * Implements the `RootsBufferReader` interface:
 * {@link ICarBufferReader.getRoots `getRoots()`}. And the `BlockBufferReader` interface:
 * {@link ICarBufferReader.get `get()`}, {@link ICarBufferReader.has `has()`},
 * {@link ICarBufferReader.blocks `blocks()`} and
 * {@link ICarBufferReader.cids `cids()`}.
 *
 * Load this class with either `import { CarBufferReader } from '@ipld/car/buffer-reader'`
 * (`const { CarBufferReader } = require('@ipld/car/buffer-reader')`). Or
 * `import { CarBufferReader } from '@ipld/car'` (`const { CarBufferReader } = require('@ipld/car')`).
 * The former will likely result in smaller bundle sizes where this is
 * important.
 *
 * @name CarBufferReader
 * @class
 * @implements {ICarBufferReader}
 * @property {number} version The version number of the CAR referenced by this
 * reader (should be `1` or `2`).
 */
export class CarBufferReader {
  /**
   * @constructs CarBufferReader
   * @param {CarHeader|CarV2Header} header
   * @param {Block[]} blocks
   */
  constructor (header, blocks) {
    this._header = header
    this._blocks = blocks
    this._cids = undefined
  }

  /**
   * @property version
   * @memberof CarBufferReader
   * @instance
   */
  get version () {
    return this._header.version
  }

  /**
   * Get the list of roots defined by the CAR referenced by this reader. May be
   * zero or more `CID`s.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {CID[]}
   */
  getRoots () {
    return this._header.roots
    /* c8 ignore next 2 */
    // Node.js 12 c8 bug
  }

  /**
   * Check whether a given `CID` exists within the CAR referenced by this
   * reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @param {CID} key
   * @returns {boolean}
   */
  has (key) {
    return this._blocks.some(b => b.cid.equals(key))
    /* c8 ignore next 2 */
    // Node.js 12 c8 bug
  }

  /**
   * Fetch a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) from the CAR
   * referenced by this reader matching the provided `CID`. In the case where
   * the provided `CID` doesn't exist within the CAR, `undefined` will be
   * returned.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @param {CID} key
   * @returns {Block | undefined}
   */
  get (key) {
    return this._blocks.find(b => b.cid.equals(key))
    /* c8 ignore next 2 */
    // Node.js 12 c8 bug
  }

  /**
   * Returns a `Block[]` of the `Block`s (`{ cid:CID, bytes:Uint8Array }` pairs) contained within
   * the CAR referenced by this reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {Block[]}
   */
  blocks () {
    return this._blocks
  }

  /**
   * Returns a `CID[]` of the `CID`s contained within the CAR referenced by this reader.
   *
   * @function
   * @memberof CarBufferReader
   * @instance
   * @returns {CID[]}
   */
  cids () {
    if (!this._cids) {
      this._cids = this._blocks.map(b => b.cid)
    }
    return this._cids
  }

  /**
   * Instantiate a {@link CarBufferReader} from a `Uint8Array` blob. This performs a
   * decode fully in memory and maintains the decoded state in memory for full
   * access to the data via the `CarReader` API.
   *
   * @static
   * @memberof CarBufferReader
   * @param {Uint8Array} bytes
   * @returns {CarBufferReader}
   */
  static fromBytes (bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError('fromBytes() requires a Uint8Array')
    }

    const { header, blocks } = BufferDecoder.fromBytes(bytes)
    return new CarBufferReader(header, blocks)
  }
}

export const __browser = true
