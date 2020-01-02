const { promisify } = require('util')
const fs = require('fs')
fs.read = promisify(fs.read)
const Block = require('@ipld/block')
const { StreamDecoder } = require('./coding')

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
 * const { indexer } = require('datastore-car')
 *
 * async function run () {
 *   const index = await indexer('big.car')
 *   index.roots = index.roots.map((cid) => cid.toString())
 *   console.log('roots:', index.roots)
 *   for await (const blockIndex of index.iterator) {
 *     blockIndex.cid = blockIndex.cid.toString()
 *     console.log('block:', blockIndex)
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
 *   'bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm',
 *   'bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'
 * ]
 * block: {
 *   cid: 'bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm',
 *   length: 55,
 *   offset: 137
 * }
 * block: {
 *   cid: 'QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d',
 *   length: 97,
 *   offset: 228
 * }
 * block: {
 *   cid: 'bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke',
 *   length: 4,
 *   offset: 362
 * }
 * ...
 * ```
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {string|ReadableStream} input either a string path name to a CAR file
 * or a ReadableStream that provides CAR archive data.
 * @returns {Object<roots:CID[],iterator:AsyncIterator>} an object containing a
 * `roots` array of CIDs and an `iterator` AsyncIterator that will yield
 * Objects of the form `{ cid:CID, offset:number, length:number }` indicating
 * the CID of the block located at start=`offset` with a length of `number` in
 * the CAR archive provided.
 */
async function indexer (inp) {
  if (typeof inp === 'string') {
    inp = fs.createReadStream(inp)
  }
  if (typeof inp !== 'object' || typeof inp.pipe !== 'function') {
    throw new TypeError('indexer() requires a file path or a ReadableStream')
  }
  const decoder = StreamDecoder(inp)
  const header = await decoder.header()
  const iterator = decoder.blocksIndex()
  return { roots: header.roots, iterator }
}

/**
 * @name CarDatastore.readRaw
 * @description
 * Read a block directly from a CAR file given an block index provided by
 * `CarDatastore.indexer()` (i.e. an object of the form:
 * `{ cid:CID, offset:number, length:number }`).
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {number|FileHandle} fd an open file descriptor, either an integer from
 * `fs.open()` or a `FileHandle` on `fs.promises.open()`.
 * @returns {Block} an IPLD [Block](https://ghub.io/@ipld/block) object.
 */
async function readRaw (fd, blockIndex) {
  const cid = blockIndex.cid
  const buf = Buffer.alloc(blockIndex.length)
  let read
  if (typeof fd === 'number') {
    read = (await fs.read(fd, buf, 0, blockIndex.length, blockIndex.offset)).bytesRead
  } else if (typeof fd === 'object' && typeof fd.read === 'function') {
    read = (await fd.read(buf, 0, blockIndex.length, blockIndex.offset)).bytesRead
  } else {
    throw new TypeError('Bad fd')
  }
  if (read !== blockIndex.length) {
    throw new Error(`Failed to read entire block (${read} instead of ${blockIndex.length})`)
  }
  return Block.create(buf, cid)
}

module.exports.indexer = indexer
module.exports.readRaw = readRaw
