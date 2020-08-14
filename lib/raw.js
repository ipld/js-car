import { promisify } from 'util'
import fs from 'fs'
import { StreamDecoder, FileDecoder } from './coding.js'
fs.read = promisify(fs.read)

/**
 * @name CarDatastore.indexer
 * @description
 * Index a CAR without decoding entire blocks. This operation is similar to
 * `CarDatastore.readStreaming()` except that it _doesn't_ reutrn a CarDatastore
 * and it skips over block data. It returns the array of root CIDs as well as
 * an AsyncIterator that will yield index data for each block in the CAR.
 *
 * The index data provided by the AsyncIterator can be stored externally and
 * used to read individual blocks directly from the car (using
 * `CarDatastore.readRaw()`).
 *
 * ```js
 * // full multiformats omitted, you'll need codecs, bases and hashes that
 * // appear in your CAR files if you want full information
 * const multiformats = ...
 * const { indexer } = require('datastore-car')(multiformats)
 *
 * async function run () {
 *   const cidStr = (cid) => `${multiformats.get(cid.code).name}:${cid.toString()}`
 *   const index = await indexer('big.car')
 *   index.roots = index.roots.map(cidStr)
 *   console.log('roots:', index.roots)
 *   for await (const blockIndex of index.iterator) {
 *     blockIndex.cid = cidStr(blockIndex.cid)
 *     console.log(JSON.toString(blockIndex))
 *   }
 * }
 *
 * run().catch((err) => {
 *   console.error(err)
 *   process.exit(1)
 * })
 * ```
 *
 * Might output something like:
 *
 * ```
 * roots: [
 *   'dag-cbor:bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm',
 *   'dag-cbor:bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'
 * ]
 * {"cid":"dag-cbor:bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm","length":92,"blockLength":55,"offset":100,"blockOffset":137}
 * {"cid":"dag-pb:QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d","length":133,"blockLength":97,"offset":192,"blockOffset":228}
 * {"cid":"raw:bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke","length":41,"blockLength":4,"offset":325,"blockOffset":362}
 * {"cid":"dag-pb:QmWXZxVQ9yZfhQxLD35eDR8LiMRsYtHxYqTFCBbJoiJVys","length":130,"blockLength":94,"offset":366,"blockOffset":402}
 * {"cid":"raw:bafkreiebzrnroamgos2adnbpgw5apo3z4iishhbdx77gldnbk57d4zdio4","length":41,"blockLength":4,"offset":496,"blockOffset":533}
 * {"cid":"dag-pb:QmdwjhxpxzcMsR3qUuj7vUL8pbA7MgR3GAxWi2GLHjsKCT","length":82,"blockLength":47,"offset":537,"blockOffset":572}
 * {"cid":"raw:bafkreidbxzk2ryxwwtqxem4l3xyyjvw35yu4tcct4cqeqxwo47zhxgxqwq","length":41,"blockLength":4,"offset":619,"blockOffset":656}
 * {"cid":"dag-cbor:bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm","length":55,"blockLength":18,"offset":660,"blockOffset":697}
 * ...
 * ```
 *
 * When indexing files, performance may vary when providing a file path compared
 * to a ReadableStream of the same file. In the latter case all of the bytes of
 * the file will be read from disk. Whereas a direct file read may be able to
 * skip over much of the block data and increase indexing speed; although the
 * reads use a buffer so there will be extraneous data read in the process and
 * if a CAR contains only small blocks then the entire file may end up being
 * read into memory.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {string|ReadableStream} input either a string path name to a CAR file
 * or a ReadableStream that provides CAR archive data.
 * @returns {Object<roots:CID[],iterator:AsyncIterator>} an object containing a
 * `roots` array of CIDs and an `iterator` AsyncIterator that will yield
 * Objects of the form `{ cid:CID, offset:number, length:number, byteOffset:number, byteLength:number }`
 * indicating the CID of the block located at `blockOffset` with a length of
 * `blockLength` in the CAR archive provided.
 */
async function indexer (multiformats, inp) {
  let decoder
  if (typeof inp === 'string') {
    decoder = await FileDecoder(multiformats, inp)
  } else if (typeof inp === 'object' && typeof inp.pipe === 'function') {
    decoder = StreamDecoder(multiformats, inp)
  } else {
    throw new TypeError('indexer() requires a file path or a ReadableStream')
  }
  const header = await decoder.header()
  const iterator = decoder.blocksIndex()
  return { roots: header.roots, iterator }
}

/**
 * @name CarDatastore.readRaw
 * @description
 * Read a block directly from a CAR file given an block index provided by
 * `CarDatastore.indexer()` (i.e. an object with the minimal form:
 * `{ cid:CID, blockOffset:number, blockLength:number }`).
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {number|FileHandle} fd an open file descriptor, either an integer from
 * `fs.open()` or a `FileHandle` on `fs.promises.open()`.
 * @param {Object} blockIndex an index object of the style provided by
 * `CarDatastore.indexer()` (`{ cid, offset, length }`).
 * @returns {object} an IPLD block of the form `{ cid, binary }`.
 */
async function readRaw (fd, blockIndex) {
  const { cid, blockLength, blockOffset } = blockIndex
  const binary = Buffer.alloc(blockLength)
  let read
  if (typeof fd === 'number') {
    read = (await fs.read(fd, binary, 0, blockLength, blockOffset)).bytesRead
  } else if (typeof fd === 'object' && typeof fd.read === 'function') {
    read = (await fd.read(binary, 0, blockLength, blockOffset)).bytesRead
  } else {
    throw new TypeError('Bad fd')
  }
  if (read !== blockLength) {
    throw new Error(`Failed to read entire block (${read} instead of ${blockLength})`)
  }
  return { cid, binary }
}

export { indexer, readRaw }
