const { NoWriter } = require('./lib/reader-writer-iface')
const { createBufferReader } = require('./lib/reader-browser')
const CarDatastore = require('./datastore')

/**
 * @name CarDatastore.readBuffer
 * @description
 * Create a CarDatastore from a Buffer containing the contents of an existing
 * CAR archive which contains IPLD data. The CarDatastore returned will not
 * support mutation operations (`put()`, `delete()`, `setRoots()`).
 *
 * This create-mode is memory intensive as the Buffer is kept in memory while
 * this CarDatastore remains active. However, this create-mode is the only
 * mode supported in a browser environment.
 * @function
 * @memberof CarDatastore
 * @static
 * @async
 * @param {Buffer|Uint8Array} buffer the byte contents of a CAR archive
 * @returns {CarDatastore} a read-only CarDatastore.
 */
async function readBuffer (buffer) {
  const reader = await createBufferReader(buffer)
  const writer = new NoWriter()
  return new CarDatastore(reader, writer)
}

module.exports.readBuffer = readBuffer
