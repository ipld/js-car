const fs = require('fs').promises
fs.createWriteStream = require('fs').createWriteStream
const { promisify } = require('util')
const { PassThrough, pipeline } = require('stream')
const pipelineAsync = promisify(pipeline)
const { Encoder, Decoder, encode, decode, encodeBuffer, decodeBuffer } = require('./coding-browser')

function streamReader (stream) {
  const iterator = stream[Symbol.asyncIterator]()
  let pos = 0
  let buf = Buffer.alloc(0)
  let offset = 0

  const readChunk = async () => {
    const next = await iterator.next()
    if (next.done) {
      return Buffer.alloc(0)
    }
    return next.value
  }

  const read = async (length) => {
    let have = buf.length - offset
    const bufa = [buf.slice(offset)]
    while (have < length) {
      const chunk = await readChunk()
      if (chunk.length === 0) {
        break
      }
      have += chunk.length
      bufa.push(chunk)
    }
    buf = Buffer.concat(bufa)
    offset = 0
  }

  return {
    async upTo (length) {
      if (buf.length - offset < length) {
        await read(length)
      }
      return buf.slice(offset, offset + Math.min(buf.length - offset, length))
    },

    async exactly (length) {
      if (buf.length - offset < length) {
        await read(length)
      }
      if (buf.length - offset < length) {
        throw new Error('Unexpected end of file')
      }
      return buf.slice(offset, offset + length)
    },

    seek (length) {
      pos += length
      offset += length
    },

    get pos () {
      return pos
    },

    close () { } // no cleanup?
  }
}

async function fileReader (file) {
  const fd = await fs.open(file, 'r')
  const buf = Buffer.alloc(1024)
  let pos = 0
  let have = 0
  let haveOffset = 0

  return {
    async upTo (length) {
      if (have - haveOffset >= length) {
        return buf.slice(haveOffset, haveOffset + length)
      }
      const { bytesRead } = await fd.read(buf, 0, buf.length, pos)
      have = bytesRead
      haveOffset = 0
      return buf.slice(0, Math.min(length, bytesRead))
    },

    async exactly (length) {
      if (have - haveOffset >= length) {
        return buf.slice(haveOffset, haveOffset + length)
      }
      const _buf = buf.length >= length ? buf : Buffer.alloc(length)
      const { bytesRead } = await fd.read(_buf, 0, _buf.length, pos)
      if (bytesRead < length) {
        throw new Error('Unexpected end of file')
      }
      have = bytesRead
      haveOffset = 0
      return _buf.length === length ? _buf : _buf.slice(0, length)
    },

    seek (length) {
      pos += length
      haveOffset += length
    },

    get pos () {
      return pos
    },

    close () {
      return fd.close()
    }
  }
}

/**
 * @name Car.decodeFile
 * @description
 * Decode a Content ARchive (CAR) file into an in-memory representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
 * [Block](https://ghub.io/@ipld/block)s.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {string} file the path to an existing CAR file.
 * @returns {Car} an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.
 */

async function decodeFile (file) {
  const reader = await fileReader(file)
  return decode(reader)
}

/**
 * @name Car.decodeStream
 * @description
 * Decode an entire Stream representing a Content ARchive (CAR) into an in-memory representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
 * [Block](https://ghub.io/@ipld/block)s.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {ReadableStream} stream a stream able to provide an entire CAR.
 * @returns {Car} an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.
 */

async function decodeStream (stream) {
  const reader = streamReader(stream)
  return decode(reader)
}

function StreamDecoder (stream) {
  const reader = streamReader(stream)
  return Decoder(reader)
}

/**
 * @name Car.encodeFile
 * @description
 * Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, writing
 * to a file.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {string} file the path to a new CAR file to be written
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in the header
 * of the archive. These are intended to be the merkle roots of all blocks.
 * @param {Block[]} blocks an array of IPLD [Block](https://ghub.io/@ipld/block)s
 * to append to the archive.
 */

function encodeFile (file, roots, blocks) {
  return pipelineAsync(encodeStream(roots, blocks), fs.createWriteStream(file))
}

/**
 * @name Car.encodeStream
 * @description
 * Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, writing
 * the data to a stream.
 *
 * There is currently no method to stream blocks into an encodeStream so you must have all
 * blocks in memory prior to encoding. Memory-efficient implementations coming soon.
 * @function
 * @memberof Car
 * @static
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in the header
 * of the archive. These are intended to be the merkle roots of all blocks.
 * @param {Block[]} blocks an array of IPLD [Block](https://ghub.io/@ipld/block)s
 * to append to the archive.
 * @returns {ReadableStream} a stream that the CAR will be written to.
 */

function encodeStream (roots, blocks) {
  const stream = new PassThrough()
  const writer = createStreamWriter(stream)
  encode(writer, roots, blocks)
    .then(() => {
      stream.end()
    }).catch((err) => {
      // maybe this could end up being recursive, with the promise rejection above, depending on conditions?
      stream.emit('error', err)
    })
  return stream
}

function createStreamWriter (stream) {
  return (buf) => {
    return new Promise((resolve, reject) => {
      stream.write(buf, (err) => {
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
module.exports.decodeBuffer = decodeBuffer
module.exports.encodeFile = encodeFile
module.exports.encodeStream = encodeStream
module.exports.encodeBuffer = encodeBuffer
module.exports.createStreamWriter = createStreamWriter
