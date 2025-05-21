import { asyncIterableReader, bytesReader, createDecoder } from './decoder.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./api.js').CarReader} CarReaderIface
 * @typedef {import('./coding.js').BytesReader} BytesReader
 * @typedef {import('./coding.js').CarHeader} CarHeader
 * @typedef {import('./coding.js').CarV2Header} CarV2Header
 */

/**
 * Provides blockstore-like access to a CAR.
 *
 * Implements the `RootsReader` interface:
 * {@link CarReader.getRoots `getRoots()`}. And the `BlockReader` interface:
 * {@link CarReader.get `get()`}, {@link CarReader.has `has()`},
 * {@link CarReader.blocks `blocks()`} (defined as a `BlockIterator`) and
 * {@link CarReader.cids `cids()`} (defined as a `CIDIterator`).
 *
 * Load this class with either `import { CarReader } from '@ipld/car/reader'`
 * (`const { CarReader } = require('@ipld/car/reader')`). Or
 * `import { CarReader } from '@ipld/car'` (`const { CarReader } = require('@ipld/car')`).
 * The former will likely result in smaller bundle sizes where this is
 * important.
 *
 * @name CarReader
 * @class
 * @implements {CarReaderIface}
 * @property {number} version The version number of the CAR referenced by this
 * reader (should be `1` or `2`).
 */
export class CarReader {
  /**
   * @constructs CarReader
   * @param {CarHeader|CarV2Header} header
   * @param {Block[]} blocks
   */
  constructor (header, blocks) {
    this._header = header
    this._blocks = blocks
    this._keys = blocks.map((b) => b.cid.toString())
  }

  /**
   * @property
   * @memberof CarReader
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
   * @memberof CarReader
   * @instance
   * @async
   * @returns {Promise<CID[]>}
   */
  async getRoots () {
    return this._header.roots
  }

  /**
   * Check whether a given `CID` exists within the CAR referenced by this
   * reader.
   *
   * @function
   * @memberof CarReader
   * @instance
   * @async
   * @param {CID} key
   * @returns {Promise<boolean>}
   */
  async has (key) {
    return this._keys.indexOf(key.toString()) > -1
  }

  /**
   * Fetch a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) from the CAR
   * referenced by this reader matching the provided `CID`. In the case where
   * the provided `CID` doesn't exist within the CAR, `undefined` will be
   * returned.
   *
   * @function
   * @memberof CarReader
   * @instance
   * @async
   * @param {CID} key
   * @returns {Promise<Block | undefined>}
   */
  async get (key) {
    const index = this._keys.indexOf(key.toString())
    return index > -1 ? this._blocks[index] : undefined
  }

  /**
   * Returns a `BlockIterator` (`AsyncIterable<Block>`) that iterates over all
   * of the `Block`s (`{ cid:CID, bytes:Uint8Array }` pairs) contained within
   * the CAR referenced by this reader.
   *
   * @function
   * @memberof CarReader
   * @instance
   * @async
   * @generator
   * @returns {AsyncGenerator<Block>}
   */
  async * blocks () {
    for (const block of this._blocks) {
      yield block
    }
  }

  /**
   * Returns a `CIDIterator` (`AsyncIterable<CID>`) that iterates over all of
   * the `CID`s contained within the CAR referenced by this reader.
   *
   * @function
   * @memberof CarReader
   * @instance
   * @async
   * @generator
   * @returns {AsyncGenerator<CID>}
   */
  async * cids () {
    for (const block of this._blocks) {
      yield block.cid
    }
  }

  /**
   * Instantiate a {@link CarReader} from a `Uint8Array` blob. This performs a
   * decode fully in memory and maintains the decoded state in memory for full
   * access to the data via the `CarReader` API.
   *
   * @async
   * @static
   * @memberof CarReader
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
   * Instantiate a {@link CarReader} from a `AsyncIterable<Uint8Array>`, such as
   * a [modern Node.js stream](https://nodejs.org/api/stream.html#stream_streams_compatibility_with_async_generators_and_async_iterators).
   * This performs a decode fully in memory and maintains the decoded state in
   * memory for full access to the data via the `CarReader` API.
   *
   * Care should be taken for large archives; this API may not be appropriate
   * where memory is a concern or the archive is potentially larger than the
   * amount of memory that the runtime can handle.
   *
   * @async
   * @static
   * @memberof CarReader
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
export async function decodeReaderComplete (reader) {
  const decoder = createDecoder(reader)
  const header = await decoder.header()
  const blocks = []
  for await (const block of decoder.blocks()) {
    blocks.push(block)
  }

  return new CarReader(header, blocks)
}

export const __browser = true
