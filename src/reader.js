import { fsread, hasFS } from './promise-fs-opts.js'
import { CarReader as BrowserCarReader } from './reader-browser.js'

/**
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./api.js').BlockIndex} BlockIndex
 * @typedef {import('./api.js').CarReader} CarReaderIface
 * @typedef {import('fs').promises.FileHandle} FileHandle
 */

/**
 * @class
 * @implements {CarReaderIface}
 */
export class CarReader extends BrowserCarReader {
  /**
   * Reads a block directly from a file descriptor for an open CAR file. This
   * function is **only available in Node.js** and not a browser environment.
   *
   * This function can be used in connection with {@link CarIndexer} which emits
   * the `BlockIndex` objects that are required by this function.
   *
   * The user is responsible for opening and closing the file used in this call.
   *
   * @async
   * @static
   * @memberof CarReader
   * @param {FileHandle | number} fd - A file descriptor from the
   * Node.js `fs` module. Either an integer, from `fs.open()` or a `FileHandle`
   * from `fs.promises.open()`.
   * @param {BlockIndex} blockIndex - An index pointing to the location of the
   * Block required. This `BlockIndex` should take the form:
   * `{cid:CID, blockLength:number, blockOffset:number}`.
   * @returns {Promise<Block>} A `{ cid:CID, bytes:Uint8Array }` pair.
   */
  static async readRaw (fd, blockIndex) {
    const { cid, blockLength, blockOffset } = blockIndex
    const bytes = new Uint8Array(blockLength)
    let read
    if (typeof fd === 'number') {
      read = (await fsread(fd, bytes, 0, blockLength, blockOffset)).bytesRead
    } else if (typeof fd === 'object' && typeof fd.read === 'function') { // FileDescriptor
      read = (await fd.read(bytes, 0, blockLength, blockOffset)).bytesRead
    } else {
      throw new TypeError('Bad fd')
    }
    if (read !== blockLength) {
      throw new Error(`Failed to read entire block (${read} instead of ${blockLength})`)
    }
    return { cid, bytes }
  }
}

export const __browser = !hasFS
