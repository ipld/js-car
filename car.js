const { Reader, NoWriter } = require('./lib/reader-writer-iface')
const { createStreamCompleteReader, createStreamingReader, createFileReader } = require('./lib/reader')
const createStreamWriter = require('./lib/writer-stream')
const CarDatastore = require('./datastore')
const { readBuffer } = require('./car-browser')
const { indexer, readRaw } = require('./lib/raw')

/**
 * @name CarDatastore.readFileComplete
 * @description
 * Read a CAR archive from a file and return a CarDatastore. The CarDatastore
 * returned will _only_ support read operations: `getRoots()`, `get()`, `has()`
 * and `query()`. Caching makes `get()` and `has()` possible as the entire
 * file is read and decoded before the CarDatastore is returned. mutation
 * operations (`put()`, `delete()` and `setRoots()`) are not available as there
 * is no ability to modify the archive.
 *
 * This create-mode is functionally similar to calling:
 * `CarDatastore.readStreamComplete(fs.createReadStream(path))`
 * However, this create-mode uses raw `fs.read()` operations to seek through
 * the file as required rather than wrapping the consumption in a ReadableStream
 * with its fixed chunk size. This distinction is unlikely to make a difference
 * until a non-buffering `readFile()` create-mode is exposed.
 *
 * Because the entire CAR archive is represented in memory after being parsed,
 * this create-mode is not suitable for large data sets. `readStreaming()`
 * should be used insead for a streaming read supporting only `query()` for an
 * iterative decode.
 *
 * This create-mode is not available in the browser environment.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {string} file a path to a file containing CAR archive data.
 * @returns {CarDatastore} a read-only CarDatastore.
 */
async function readFileComplete (file) {
  const reader = await createFileReader(file)
  const writer = new NoWriter()
  return new CarDatastore(reader, writer)
}

/**
 * @name CarDatastore.readStreamComplete
 * @description
 * Read a CAR archive as a CarDataStore from a ReadableStream. The CarDatastore
 * returned will _only_ support read operations: `getRoots()`, `get()`, `has()`
 * and `query()`. Caching makes `get()` and `has()` possible as the entire
 * stream is read and decoded before the CarDatastore is returned. Mutation
 * operations (`put()`, `delete()` and `setRoots()`) are not available as there
 * is no ability to modify the archive.
 *
 * Because the entire CAR archive is represented in memory after being parsed,
 * this create-mode is not suitable for large data sets. `readStreaming()` should
 * be used instead for a streaming read supporting only `query()` for an
 * iterative decode.
 *
 * This create-mode is not available in the browser environment.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {ReadableStream} stream a ReadableStream that provides an entire CAR
 * archive as a binary stream.
 * @returns {CarDatastore} a read-only CarDatastore.
 */
async function readStreamComplete (stream) {
  const reader = await createStreamCompleteReader(stream)
  const writer = new NoWriter()
  return new CarDatastore(reader, writer)
}

/**
 * @name CarDatastore.readStreaming
 * @description
 * Read a CAR archive as a CarDataStore from a ReadableStream. The CarDatastore
 * returned will _only_ support `getRoots()` and an iterative `query()` call.
 * As there is no caching, individual `get()` or `has()` operations are not
 * possible and mutation operations (`put()`, `delete()` and `setRoots()`) are
 * not available as there is no ability to modify the archive.
 *
 * `readStreaming()` is an efficient create-mode, useful for reading large CAR
 * archives without using much memory. Its support for a simple iterative
 * `query()` method make its utility as a general Datastore very limited.
 *
 * `readStreamComplete()` is an alternative stream decoding create-mode that uses
 * buffering to decode an entire stream into an in-memory representation of the
 * CAR archive. This may be used if `get()` and `has()` operations are required
 * and the amount of data is manageable in memory.
 *
 * This create-mode is not available in the browser environment.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {ReadableStream} stream a ReadableStream that provides an entire CAR
 * archive as a binary stream.
 * @returns {CarDatastore} a read-only CarDatastore.
 */
async function readStreaming (stream) {
  const reader = await createStreamingReader(stream)
  const writer = new NoWriter()
  return new CarDatastore(reader, writer)
}

/**
 * @name CarDatastore.writeStream
 * @description
 * Create a CarDatastore that writes a CAR archive to a WritableStream. The
 * CarDatastore returned will _only_ support append operations (`put()` and
 * `setRoots()`, but not `delete()`) and no caching will be performed, with
 * entries written directly to the provided stream.
 *
 * Because the roots are encoded in the header of a CAR file, a call to
 * `setRoots()` must be made prior to any `put()` operation. Absent of a
 * `setRoots()` call, the header will be encoded with an empty list of root
 * CIDs. A call to `setRoots()` after one or more calls to `put()` will result
 * in an Error being thrown.
 *
 * `writeStream()` is an efficient create-mode, useful for writing large amounts
 * of data to CAR archive as long as the roots are known before writing.
 *
 * This create-mode is not available in a browser environment.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {WritableStream} stream a writable stream
 * @returns {CarDatastore} an append-only, streaming CarDatastore.
 */
async function writeStream (stream) {
  const reader = new Reader()
  const writer = await createStreamWriter(stream)
  return new CarDatastore(reader, writer)
}

async function traverseBlock (block, get, car, seen = new Set()) {
  const cid = await block.cid()
  await car.put(cid, block.encodeUnsafe())
  seen.add(cid.toString('base64'))
  if (cid.codec === 'raw') return
  const reader = block.reader()
  for (const [, link] of reader.links()) {
    if (seen.has(link.toString('base64'))) continue
    await traverseBlock(await get(link), get, car, seen)
  }
}

async function completeGraph (root, get, car) {
  await car.setRoots([root])
  await traverseBlock(await get(root), get, car)
  await car.close()
}

module.exports.readBuffer = readBuffer
module.exports.readFileComplete = readFileComplete
module.exports.readStreamComplete = readStreamComplete
module.exports.readStreaming = readStreaming
module.exports.writeStream = writeStream
module.exports.indexer = indexer
module.exports.readRaw = readRaw
module.exports.completeGraph = completeGraph
