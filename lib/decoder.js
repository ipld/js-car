import varint from 'varint'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { decode as decodeDagCbor } from '@ipld/dag-cbor'
import { CarHeader as headerValidator } from './header-validator.js'

/**
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockHeader} BlockHeader
 * @typedef {import('../api').BlockIndex} BlockIndex
 * @typedef {import('./coding').BytesReader} BytesReader
 * @typedef {import('./coding').CarHeader} CarHeader
 * @typedef {import('./coding').CarV2Header} CarV2Header
 * @typedef {import('./coding').CarV2FixedHeader} CarV2FixedHeader
 * @typedef {import('./coding').CarDecoder} CarDecoder
 */

const CIDV0_BYTES = {
  SHA2_256: 0x12,
  LENGTH: 0x20,
  DAG_PB: 0x70
}

const V2_HEADER_LENGTH = /* characteristics */ 16 /* v1 offset */ + 8 /* v1 size */ + 8 /* index offset */ + 8

/**
 * @param {BytesReader} reader
 * @returns {Promise<number>}
 */
async function readVarint (reader) {
  const bytes = await reader.upTo(8)
  if (!bytes.length) {
    throw new Error('Unexpected end of data')
  }
  const i = varint.decode(bytes)
  reader.seek(varint.decode.bytes)
  return i
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<CarV2FixedHeader>}
 */
async function readV2Header (reader) {
  /** @type {Uint8Array} */
  const bytes = await reader.exactly(V2_HEADER_LENGTH)
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  const header = {
    version: 2,
    /** @type {[bigint, bigint]} */
    characteristics: [
      dv.getBigUint64(offset, true),
      dv.getBigUint64(offset += 8, true)
    ],
    dataOffset: Number(dv.getBigUint64(offset += 8, true)),
    dataSize: Number(dv.getBigUint64(offset += 8, true)),
    indexOffset: Number(dv.getBigUint64(offset += 8, true))
  }
  reader.seek(V2_HEADER_LENGTH)
  return header
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * Reads header data from a `BytesReader`. The header may either be in the form
 * of a `CarHeader` or `CarV2Header` depending on the CAR being read.
 *
 * @name async decoder.readHeader(reader)
 * @param {BytesReader} reader
 * @param {number} [strictVersion]
 * @returns {Promise<CarHeader|CarV2Header>}
 */
export async function readHeader (reader, strictVersion) {
  const length = await readVarint(reader)
  if (length === 0) {
    throw new Error('Invalid CAR header (zero length)')
  }
  const header = await reader.exactly(length)
  reader.seek(length)
  const block = decodeDagCbor(header)
  if (!headerValidator(block)) {
    throw new Error('Invalid CAR header format')
  }
  if ((block.version !== 1 && block.version !== 2) || (strictVersion !== undefined && block.version !== strictVersion)) {
    throw new Error(`Invalid CAR version: ${block.version}${strictVersion !== undefined ? ` (expected ${strictVersion})` : ''}`)
  }
  // we've made 'roots' optional in the schema so we can do the version check
  // before rejecting the block as invalid if there is no version
  const hasRoots = Array.isArray(block.roots)
  if ((block.version === 1 && !hasRoots) || (block.version === 2 && hasRoots)) {
    throw new Error('Invalid CAR header format')
  }
  if (block.version === 1) {
    return block
  }
  // version 2
  const v2Header = await readV2Header(reader)
  reader.seek(v2Header.dataOffset - reader.pos)
  const v1Header = await readHeader(reader, 1)
  return Object.assign(v1Header, v2Header)
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<Uint8Array>}
 */
async function readMultihash (reader) {
  // | code | length | .... |
  // where both code and length are varints, so we have to decode
  // them first before we can know total length

  const bytes = await reader.upTo(8)
  varint.decode(bytes) // code
  const codeLength = varint.decode.bytes
  const length = varint.decode(bytes.subarray(varint.decode.bytes))
  const lengthLength = varint.decode.bytes
  const mhLength = codeLength + lengthLength + length
  const multihash = await reader.exactly(mhLength)
  reader.seek(mhLength)
  return multihash
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<CID>}
 */
async function readCid (reader) {
  const first = await reader.exactly(2)
  if (first[0] === CIDV0_BYTES.SHA2_256 && first[1] === CIDV0_BYTES.LENGTH) {
    // cidv0 32-byte sha2-256
    const bytes = await reader.exactly(34)
    reader.seek(34)
    const multihash = Digest.decode(bytes)
    return CID.create(0, CIDV0_BYTES.DAG_PB, multihash)
  }

  const version = await readVarint(reader)
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`)
  }
  const codec = await readVarint(reader)
  const bytes = await readMultihash(reader)
  const multihash = Digest.decode(bytes)
  return CID.create(version, codec, multihash)
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * Reads the leading data of an individual block from CAR data from a
 * `BytesReader`. Returns a `BlockHeader` object which contains
 * `{ cid, length, blockLength }` which can be used to either index the block
 * or read the block binary data.
 *
 * @name async decoder.readBlockHead(reader)
 * @param {BytesReader} reader
 * @returns {Promise<BlockHeader>}
 */
export async function readBlockHead (reader) {
  // length includes a CID + Binary, where CID has a variable length
  // we have to deal with
  const start = reader.pos
  let length = await readVarint(reader)
  if (length === 0) {
    throw new Error('Invalid CAR section (zero length)')
  }
  length += (reader.pos - start)
  const cid = await readCid(reader)
  const blockLength = length - Number(reader.pos - start) // subtract CID length

  return { cid, length, blockLength }
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * @param {BytesReader} reader
 * @return {Promise<Block>}
 */
async function readBlock (reader) {
  const { cid, blockLength } = await readBlockHead(reader)
  const bytes = await reader.exactly(blockLength)
  reader.seek(blockLength)
  return { bytes, cid }
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * @param {BytesReader} reader
 * @returns {Promise<BlockIndex>}
 */
async function readBlockIndex (reader) {
  const offset = reader.pos
  const { cid, length, blockLength } = await readBlockHead(reader)
  const index = { cid, length, blockLength, offset, blockOffset: reader.pos }
  reader.seek(index.blockLength)
  return index
  /* c8 ignore next 2 */
  // Node.js 12 c8 bug
}

/**
 * Creates a `CarDecoder` from a `BytesReader`. The `CarDecoder` is as async
 * interface that will consume the bytes from the `BytesReader` to yield a
 * `header()` and either `blocks()` or `blocksIndex()` data.
 *
 * @name decoder.createDecoder(reader)
 * @param {BytesReader} reader
 * @returns {CarDecoder}
 */
export function createDecoder (reader) {
  const headerPromise = (async () => {
    const header = await readHeader(reader)
    if (header.version === 2) {
      const v1length = reader.pos - header.dataOffset
      reader = limitReader(reader, header.dataSize - v1length)
    }
    return header
    /* c8 ignore next 2 */
    // Node.js 12 c8 bug
  })()

  return {
    header: () => headerPromise,

    async * blocks () {
      await headerPromise
      while ((await reader.upTo(8)).length > 0) {
        yield await readBlock(reader)
      }
    },

    async * blocksIndex () {
      await headerPromise
      while ((await reader.upTo(8)).length > 0) {
        yield await readBlockIndex(reader)
      }
    }
  }
}

/**
 * Creates a `BytesReader` from a `Uint8Array`.
 *
 * @name decoder.bytesReader(bytes)
 * @param {Uint8Array} bytes
 * @returns {BytesReader}
 */
export function bytesReader (bytes) {
  let pos = 0

  /** @type {BytesReader} */
  return {
    async upTo (length) {
      return bytes.subarray(pos, pos + Math.min(length, bytes.length - pos))
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    async exactly (length) {
      if (length > bytes.length - pos) {
        throw new Error('Unexpected end of data')
      }
      return bytes.subarray(pos, pos + length)
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    seek (length) {
      pos += length
    },

    get pos () {
      return pos
    }
  }
}

/**
 * @ignore
 * reusable reader for streams and files, we just need a way to read an
 * additional chunk (of some undetermined size) and a way to close the
 * reader when finished
 * @param {() => Promise<Uint8Array|null>} readChunk
 * @returns {BytesReader}
 */
export function chunkReader (readChunk /*, closer */) {
  let pos = 0
  let have = 0
  let offset = 0
  let currentChunk = new Uint8Array(0)

  const read = async (/** @type {number} */ length) => {
    have = currentChunk.length - offset
    const bufa = [currentChunk.subarray(offset)]
    while (have < length) {
      const chunk = await readChunk()
      if (chunk == null) {
        break
      }
      /* c8 ignore next 8 */
      // undo this ignore ^ when we have a fd implementation that can seek()
      if (have < 0) { // because of a seek()
        /* c8 ignore next 4 */
        // toohard to test the else
        if (chunk.length > have) {
          bufa.push(chunk.subarray(-have))
        } // else discard
      } else {
        bufa.push(chunk)
      }
      have += chunk.length
    }
    currentChunk = new Uint8Array(bufa.reduce((p, c) => p + c.length, 0))
    let off = 0
    for (const b of bufa) {
      currentChunk.set(b, off)
      off += b.length
    }
    offset = 0
  }

  /** @type {BytesReader} */
  return {
    async upTo (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      return currentChunk.subarray(offset, offset + Math.min(currentChunk.length - offset, length))
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    async exactly (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      if (currentChunk.length - offset < length) {
        throw new Error('Unexpected end of data')
      }
      return currentChunk.subarray(offset, offset + length)
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    seek (length) {
      pos += length
      offset += length
    },

    get pos () {
      return pos
    }
  }
}

/**
 * Creates a `BytesReader` from an `AsyncIterable<Uint8Array>`, which allows for
 * consumption of CAR data from a streaming source.
 *
 * @name decoder.asyncIterableReader(asyncIterable)
 * @param {AsyncIterable<Uint8Array>} asyncIterable
 * @returns {BytesReader}
 */
export function asyncIterableReader (asyncIterable) {
  const iterator = asyncIterable[Symbol.asyncIterator]()

  async function readChunk () {
    const next = await iterator.next()
    if (next.done) {
      return null
    }
    return next.value
    /* c8 ignore next 2 */
    // Node.js 12 c8 bug
  }

  return chunkReader(readChunk)
}

/**
 * Wraps a `BytesReader` in a limiting `BytesReader` which limits maximum read
 * to `byteLimit` bytes. It _does not_ update `pos` of the original
 * `BytesReader`.
 *
 * @name decoder.limitReader(reader, byteLimit)
 * @param {BytesReader} reader
 * @param {number} byteLimit
 * @returns {BytesReader}
 */
export function limitReader (reader, byteLimit) {
  let bytesRead = 0

  /** @type {BytesReader} */
  return {
    async upTo (length) {
      let bytes = await reader.upTo(length)
      if (bytes.length + bytesRead > byteLimit) {
        bytes = bytes.subarray(0, byteLimit - bytesRead)
      }
      return bytes
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    async exactly (length) {
      const bytes = await reader.exactly(length)
      if (bytes.length + bytesRead > byteLimit) {
        throw new Error('Unexpected end of data')
      }
      return bytes
      /* c8 ignore next 2 */
      // Node.js 12 c8 bug
    },

    seek (length) {
      bytesRead += length
      reader.seek(length)
    },

    get pos () {
      return reader.pos
    }
  }
}
