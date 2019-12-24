const { Reader, NoWriter } = require('./lib/reader-writer-iface')
const { createStreamCompleteReader, createStreamingReader, createFileReader } = require('./lib/reader')
const createStreamWriter = require('./lib/writer-stream')
const CarDatastore = require('./datastore')
const { readBuffer } = require('./car-browser')

/**
 * @name CarDatastore.readFile
 * @description
 * TODO
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {string} file TODO
 * @returns {CarDatastore} a read-only CarDatastore.
 */
async function readFile (file) {
  const reader = await createFileReader(file)
  const writer = new NoWriter()
  return new CarDatastore(reader, writer)
}

/**
 * @name CarDatastore.readStreamComplete
 * @description
 * TODO
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {ReadableStream} stream TODO
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
 * TODO
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {ReadableStream} stream TODO
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
 * Create a CarDatastore that writes to a writable stream. The CarDatastore
 * returned will _only_ support append operations (`put()` and `setRoots()`, but
 * not `delete()`) and no caching will be performed, with entries written
 * directly to the provided stream.
 *
 * This is an efficient create-mode, useful for writing large amounts of data to
 * CAR archive.
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

module.exports.readBuffer = readBuffer
module.exports.readFile = readFile
module.exports.readStreamComplete = readStreamComplete
module.exports.readStreaming = readStreaming
module.exports.writeStream = writeStream
