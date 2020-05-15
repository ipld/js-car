const fs = require('fs').promises
fs.createWriteStream = require('fs').createWriteStream
const { promisify } = require('util')
const { PassThrough, pipeline } = require('stream')
const pipelineAsync = promisify(pipeline)
const { Encoder, Decoder, encode, decode, encodeBuffer, decodeBuffer } = require('./coding-browser')

// reusable reader for streams and files, we just need a way to read an
// additional chunk (of some undetermined size) and a way to close the
// reader when finished
function chunkReader (readChunk, closer) {
  let pos = 0
  let have = 0
  let offset = 0
  let currentChunk = Buffer.alloc(0)

  const read = async (length) => {
    have = currentChunk.length - offset
    const bufa = [currentChunk.slice(offset)]
    while (have < length) {
      const chunk = await readChunk()
      if (chunk.length === 0) {
        break
      }
      if (have < 0) { // because of a seek()
        // istanbul ignore next toohard to test the else
        if (chunk.length > have) {
          bufa.push(chunk.slice(-have))
        } // else discard
      } else {
        bufa.push(chunk)
      }
      have += chunk.length
    }
    currentChunk = Buffer.concat(bufa)
    offset = 0
  }

  return {
    async upTo (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      return currentChunk.slice(offset, offset + Math.min(currentChunk.length - offset, length))
    },

    async exactly (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      if (currentChunk.length - offset < length) {
        throw new Error('Unexpected end of file')
      }
      return currentChunk.slice(offset, offset + length)
    },

    seek (length) {
      pos += length
      offset += length
    },

    get pos () {
      return pos
    },

    close () {
      return closer && closer()
    }
  }
}

function streamReader (stream) {
  // repurpose the ReadableStream async iterator as a chunk reader
  const iterator = stream[Symbol.asyncIterator]()

  async function readChunk () {
    const next = await iterator.next()
    if (next.done) {
      return Buffer.alloc(0)
    }
    return next.value
  }

  return chunkReader(readChunk)
}

async function fileReader (file, options) {
  const fd = await fs.open(file, 'r')
  const bufferSize = typeof options === 'object' && typeof options.bufferSize === 'number' ? options.bufferSize : 1024
  const readerChunk = Buffer.alloc(bufferSize)

  async function readChunk () {
    const { bytesRead } = await fd.read(readerChunk, 0, readerChunk.length)
    if (!bytesRead) {
      return Buffer.alloc(0)
    }
    return Uint8Array.prototype.slice.call(readerChunk, 0, bytesRead)
  }

  function close () {
    return fd.close()
  }

  return chunkReader(readChunk, close)
}

/**
 * @name coding.decodeFile
 * @description
 * Decode a Content ARchive (CAR) file into an in-memory representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
 * blocks of the form `{ cid, binary }`.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').decodeFile`.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {string} file the path to an existing CAR file.
 * @returns {Car} an in-memory representation of a CAR file:
 * `{ version, roots[], blocks[] }`.
 */

async function decodeFile (multiformats, file, options) {
  const reader = await fileReader(file, options)
  return decode(multiformats, reader)
}

async function FileDecoder (multiformats, file, options) {
  const reader = await fileReader(file, options)
  return Decoder(multiformats, reader)
}

/**
 * @name coding.decodeStream
 * @description
 * Decode an entire Stream representing a Content ARchive (CAR) into an
 * in-memory representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
 * blocks of the form `{ cid, binary }`.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').decodeStream`.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {ReadableStream} stream a stream able to provide an entire CAR.
 * @returns {Car} an in-memory representation of a CAR file:
 * `{ version, roots[], blocks[] }`.
 */

async function decodeStream (multiformats, stream) {
  const reader = streamReader(stream)
  return decode(multiformats, reader)
}

function StreamDecoder (multiformats, stream) {
  const reader = streamReader(stream)
  return Decoder(multiformats, reader)
}

/**
 * @name coding.encodeFile
 * @description
 * Encode a set of IPLD blocks of the form `{ cid, binary }` in CAR format,
 * writing to a file.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').encodeFile`.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {string} file the path to a new CAR file to be written
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in
 * the header of the archive. These are intended to be the merkle roots of all
 * blocks.
 * @param {object[]} blocks an array of IPLD blocks of the form `{ cid, binary }`
 * to append to the archive.
 */

function encodeFile (multiformats, file, roots, blocks) {
  return pipelineAsync(encodeStream(multiformats, roots, blocks), fs.createWriteStream(file))
}

/**
 * @name coding.encodeStream
 * @description
 * Encode a set of IPLD blocks of the form `{ cid, binary }`,
 * writing the data to a stream.
 *
 * There is currently no method to stream blocks into an encodeStream so you
 * must have all blocks in memory prior to encoding. Memory-efficient
 * implementations coming soon.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').encodeStream`.
 * @function
 * @memberof Car
 * @static
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in
 * the header of the archive. These are intended to be the merkle roots of all
 * blocks.
 * @param {object[]} blocks an array of IPLD blocks of the form `{ cid, binary }`.
 * to append to the archive.
 * @returns {ReadableStream} a stream that the CAR will be written to.
 */

function encodeStream (multiformats, roots, blocks) {
  const stream = new PassThrough()
  const writer = createStreamWriter(stream)
  encode(multiformats, writer, roots, blocks)
    .then(() => {
      stream.end()
    }).catch((err) => {
      /* c8 ignore next 3 */
      // maybe this could end up being recursive, with the promise rejection
      // above, depending on conditions?
      stream.emit('error', err)
    })
  return stream
}

function createStreamWriter (stream) {
  return (buf) => {
    return new Promise((resolve, reject) => {
      stream.write(buf, (err) => {
        /* c8 ignore next 3 */
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}

module.exports.Encoder = Encoder
module.exports.Decoder = Decoder
module.exports.decodeFile = decodeFile
module.exports.decodeStream = decodeStream
module.exports.StreamDecoder = StreamDecoder
module.exports.FileDecoder = FileDecoder
module.exports.decodeBuffer = decodeBuffer
module.exports.encodeFile = encodeFile
module.exports.encodeStream = encodeStream
module.exports.encodeBuffer = encodeBuffer
module.exports.createStreamWriter = createStreamWriter
