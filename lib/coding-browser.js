const varint = require('varint')
const { isBlock, isCID } = require('./util')

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

async function readVarint (reader) {
  const bytes = await reader.upTo(8)
  const i = varint.decode(bytes)
  reader.seek(varint.decode.bytes)
  return i
}

async function readHeader (multiformats, reader) {
  const length = await readVarint(reader)
  const header = await reader.exactly(length)
  reader.seek(length)
  return multiformats.decode(header, 'dag-cbor')
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

async function readCid (multiformats, reader) {
  const first = await reader.exactly(2)
  if (first[0] === 0x12 && first[1] === 0x20) {
    // cidv0 32-byte sha2-256
    const bytes = await reader.exactly(34)
    reader.seek(34)
    return new multiformats.CID(0, 0x70, new Uint8Array(bytes))
  }

  const version = await readVarint(reader)
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`)
  }
  const codec = await readVarint(reader)
  const multihash = await readMultihash(reader)
  return new multiformats.CID(version, codec, new Uint8Array(multihash))
}

async function readBlockHead (multiformats, reader) {
  // length includes a CID + Block, where CID has a variable length
  // we have to deal with
  const totalLength = await readVarint(reader)
  const start = reader.pos
  const cid = await readCid(multiformats, reader)
  const length = totalLength - (reader.pos - start) // subtract CID length

  return { cid, length }
}

async function readBlock (multiformats, reader) {
  const { cid, length } = await readBlockHead(multiformats, reader)
  const binary = await reader.exactly(length)
  reader.seek(length)
  return { cid, binary }
}

async function readBlockIndex (multiformats, reader) {
  const head = await readBlockHead(multiformats, reader)
  head.offset = reader.pos
  reader.seek(head.length)
  return head
}

function Decoder (multiformats, reader) {
  const headerPromise = readHeader(multiformats, reader)
  function blockReader (index) {
    return async function * blockIterator () {
      await headerPromise
      try {
        while ((await reader.upTo(8)).length > 0) {
          yield await (index ? readBlockIndex(multiformats, reader) : readBlock(multiformats, reader))
        }
      } finally {
        await reader.close()
      }
    }
  }
  return {
    header: () => headerPromise,
    blocks: blockReader(),
    blocksIndex: blockReader(true)
  }
}

async function decode (multiformats, reader) {
  const decoder = Decoder(multiformats, reader)
  const header = await decoder.header()
  const decoded = {
    version: header.version,
    roots: header.roots,
    blocks: []
  }
  for await (const block of decoder.blocks()) {
    decoded.blocks.push(block)
  }
  return decoded
}

function Encoder (multiformats, writer) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites
  return {
    async setRoots (roots) {
      if (!Array.isArray(roots)) {
        roots = [roots]
      }
      for (const root of roots) {
        if (!isCID(root)) {
          throw new TypeError('Roots must be CIDs')
        }
      }

      const header = await multiformats.encode({ version: 1, roots }, 'dag-cbor')
      await writer(Buffer.from(varint.encode(header.length)))
      await writer(header)
    },

    async writeBlock (block) {
      if (!isBlock(block)) {
        throw new TypeError('Block list must be of type { cid, binary }')
      }
      await writer(Buffer.from(varint.encode(block.cid.buffer.length + block.binary.length)))
      await writer(block.cid.buffer)
      await writer(block.binary)
    }
  }
}

async function encode (multiformats, writer, roots, blocks) {
  const encoder = Encoder(multiformats, writer)
  await encoder.setRoots(roots)
  for (const block of blocks) {
    await encoder.writeBlock(block)
  }
}

/**
 * @name Car.decodeBuffer
 * @description
 * Decode a `Buffer` representation of a Content ARchive (CAR) into an in-memory
 * representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD blocks of the
 * form `{ cid, binary }`.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').decodeBuffer`, or
 * `require('datastore-car/lib/coding-browser').decodeBuffer` in a browser
 * environment.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {Buffer} buf the contents of a CAR
 * @returns {Car} an in-memory representation of a CAR file:
 * `{ version, roots[], blocks[] }`.
 */

async function decodeBuffer (multiformats, buf) {
  const reader = bufferReader(buf)
  return decode(multiformats, reader)
}

/* unnecessary, but this is possible:
function BufferDecoder (buf) {
  const reader = bufferReader(buf)
  return Decoder(reader)
}
*/

/**
 * @name Car.encodeBuffer
 * @description
 * Encode a set of IPLD blocks of the form `{ cid, binary }` in CAR format,
 * returning it as a single `Buffer`.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {CID[]} roots an array of root [CID](https://ghub.io/cids)s to set in
 * the header of the archive. These are intended to be the merkle roots of all
 * blocks.
 * @param {object[]} blocks an array of IPLD blocks of the form `{ cid, binary }`
 * to append to the archive.
 * @returns {Buffer} a `Buffer` representing the created archive.
 */

async function encodeBuffer (multiformats, roots, blocks) {
  const bl = []
  const writer = (buf) => { bl.push(buf) }
  await encode(multiformats, writer, roots, blocks)
  return Buffer.concat(bl)
}

module.exports.encode = encode
module.exports.Encoder = Encoder
module.exports.decode = decode
module.exports.Decoder = Decoder
module.exports.decodeBuffer = decodeBuffer
module.exports.encodeBuffer = encodeBuffer
