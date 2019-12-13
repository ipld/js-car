const fs = require('fs').promises
fs.createWriteStream = require('fs').createWriteStream
const { promisify } = require('util')
const { PassThrough, pipeline } = require('stream')
const pipelineAsync = promisify(pipeline)
const CID = require('cids')
const multicodec = require('multicodec')
const Block = require('@ipld/block')
const varint = require('varint')

function bufferReader (buf) {
  let pos = 0

  return {
    async upTo (length) {
      return buf.slice(pos, pos + Math.min(length, buf.length - pos))
    },

    async exactly (length) {
      if (length > buf.length - pos) {
        throw new Error('Unexpected end of Buffer')
      }
      return buf.slice(pos, pos + length)
    },

    seek (length) {
      pos += length
    },

    get pos () {
      return pos
    },

    close () { }
  }
}

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

async function readVarint (reader) {
  const bytes = await reader.upTo(8)
  const i = varint.decode(bytes)
  reader.seek(varint.decode.bytes)
  return i
}

async function readHeader (reader) {
  const length = await readVarint(reader)
  const header = await reader.exactly(length)
  reader.seek(length)
  const block = Block.decoder(header, 'dag-cbor')
  return block.decode()
}

async function readMultihash (reader) {
  // | code | length | .... |
  // where both code and length are varints, so we have to decode
  // them first before we can know total length

  const bytes = await reader.upTo(8)
  varint.decode(bytes) // code
  const codeLength = varint.decode.bytes
  const length = varint.decode(bytes.slice(varint.decode.bytes))
  const lengthLength = varint.decode.bytes
  const mhLength = codeLength + lengthLength + length
  const multihash = await reader.exactly(mhLength)
  reader.seek(mhLength)
  return multihash
}

async function readCid (reader) {
  const first = await reader.exactly(2)
  if (first[0] === 0x12 && first[1] === 0x20) {
    // cidv0 32-byte sha2-256
    const bytes = await reader.exactly(34)
    reader.seek(34)
    return new CID(bytes)
  }

  const version = await readVarint(reader)
  if (version !== 1) {
    throw new Error('Got a CID format / version I can\'t decode')
  }
  const codec = await readVarint(reader)
  const multihash = await readMultihash(reader)
  return new CID(version, multicodec.getName(codec), multihash)
}

async function readBlock (reader) {
  // length includes a CID + Block, where CID has a variable length
  // we have to deal with
  const length = await readVarint(reader)
  const start = reader.pos
  const cid = await readCid(reader)
  const blockLength = length - (reader.pos - start) // subtract CID length
  const buf = await reader.exactly(blockLength)
  reader.seek(blockLength)
  return Block.create(buf, cid)
}

async function decode (reader) {
  const header = await readHeader(reader)
  const decoded = {
    version: header.version,
    roots: header.roots,
    blocks: []
  }
  while ((await reader.upTo(8)).length > 0) {
    const block = await readBlock(reader)
    decoded.blocks.push(block)
  }
  await reader.close()
  return decoded
}

async function encode (writer, roots, blocks) {
  if (!Array.isArray(roots)) {
    roots = [roots]
  }
  for (const root of roots) {
    if (!CID.isCID(root)) {
      throw new TypeError('Roots must be CIDs')
    }
  }

  const header = Block.encoder({ version: 1, roots }, 'dag-cbor').encode()
  await writer(Buffer.from(varint.encode(header.length)))
  await writer(header)

  for (const block of blocks) {
    if (!Block.isBlock(block)) {
      throw new TypeError('Block list must contain @ipld/block objects')
    }
    const cid = await block.cid()
    const encoded = block.encode()
    await writer(Buffer.from(varint.encode(cid.buffer.length + encoded.length)))
    await writer(cid.buffer)
    await writer(encoded)
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
 * @name Car.decodeBuffer
 * @description
 * Decode a `Buffer` representation of a Content ARchive (CAR) into an in-memory representation:
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
 * @param {Buffer} buf the contents of a CAR
 * @returns {Car} an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.
 */

async function decodeBuffer (buf) {
  const reader = bufferReader(buf)
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
 * @name Car.encodeBuffer
 * @description
 * Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, returning
 * it as a single `Buffer`.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in the header
 * of the archive. These are intended to be the merkle roots of all blocks.
 * @param {Block[]} blocks an array of IPLD [Block](https://ghub.io/@ipld/block)s
 * to append to the archive.
 * @returns {Buffer} a `Buffer` representing the created archive.
 */

async function encodeBuffer (roots, blocks) {
  const bl = []
  const writer = (buf) => { bl.push(buf) }
  await encode(writer, roots, blocks)
  return Buffer.concat(bl)
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
  const writer = (buf) => {
    return new Promise((resolve, reject) => {
      stream.write(buf, (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
  encode(writer, roots, blocks)
    .then(() => {
      stream.end()
    }).catch((err) => {
      // maybe this could end up being recursive, with the promise rejection above, depending on conditions?
      stream.emit('error', err)
    })
  return stream
}

module.exports.decodeFile = decodeFile
module.exports.decodeStream = decodeStream
module.exports.decodeBuffer = decodeBuffer
module.exports.encodeFile = encodeFile
module.exports.encodeStream = encodeStream
module.exports.encodeBuffer = encodeBuffer
