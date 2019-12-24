const varint = require('varint')
const CID = require('cids')
const multicodec = require('multicodec')
const Block = require('@ipld/block')

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

function Decoder (reader) {
  const headerPromise = readHeader(reader)
  return {
    header: () => headerPromise,
    blocks: async function * () {
      await headerPromise
      while ((await reader.upTo(8)).length > 0) {
        yield await readBlock(reader)
      }
      await reader.close()
    }
  }
}

async function decode (reader) {
  const decoder = Decoder(reader)
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

function Encoder (writer) {
  return {
    async setRoots (roots) {
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
    },

    async writeBlock (block) {
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
}

async function encode (writer, roots, blocks) {
  const encoder = Encoder(writer)
  await encoder.setRoots(roots)
  for (const block of blocks) {
    await encoder.writeBlock(block)
  }
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

/* unnecessary, but this is possible:
function BufferDecoder (buf) {
  const reader = bufferReader(buf)
  return Decoder(reader)
}
*/

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

module.exports.encode = encode
module.exports.Encoder = Encoder
module.exports.decode = decode
module.exports.Decoder = Decoder
module.exports.decodeBuffer = decodeBuffer
module.exports.encodeBuffer = encodeBuffer
