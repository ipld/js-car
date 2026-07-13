import { decode as decodeDagCbor } from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import * as Digest from 'multiformats/hashes/digest'
import { CIDV0_BYTES, decodeV2Header, decodeVarint, getMultihashLength, V2_HEADER_LENGTH } from './decoder-common.js'
import { CarV1HeaderOrV2Pragma } from './header-validator.js'
import { MAX_DIGEST_ALLOC, resolveLimits } from './limits.js'

/**
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./api.js').BlockHeader} BlockHeader
 * @typedef {import('./api.js').BlockIndex} BlockIndex
 * @typedef {import('./coding.js').BytesReader} BytesReader
 * @typedef {import('./coding.js').CarHeader} CarHeader
 * @typedef {import('./coding.js').CarV2Header} CarV2Header
 * @typedef {import('./coding.js').CarV2FixedHeader} CarV2FixedHeader
 * @typedef {import('./coding.js').CarDecoder} CarDecoder
 * @typedef {import('./api.js').CarCodecOptions} CarCodecOptions
 * @typedef {import('./limits.js').CarLimits} CarLimits
 */

/**
 * Reads header data from a `BytesReader`. The header may either be in the form
 * of a `CarHeader` or `CarV2Header` depending on the CAR being read.
 *
 * @name async decoder.readHeader(reader)
 * @param {BytesReader} reader
 * @param {number} [strictVersion]
 * @param {CarLimits} [limits]
 * @returns {Promise<CarHeader|CarV2Header>}
 */
export async function readHeader (reader, strictVersion, limits = resolveLimits()) {
  const length = decodeVarint(await reader.upTo(8), reader)
  if (length === 0) {
    throw new Error('Invalid CAR header (zero length)')
  }
  if (length > limits.maxAllowedHeaderSize) {
    throw new RangeError(`CAR header of length ${length} exceeds maxAllowedHeaderSize of ${limits.maxAllowedHeaderSize}`)
  }
  const header = await reader.exactly(length, true)
  const block = decodeDagCbor(header)
  if (CarV1HeaderOrV2Pragma.toTyped(block) === undefined) {
    throw new Error('Invalid CAR header format')
  }
  if ((block.version !== 1 && block.version !== 2) || (strictVersion !== undefined && block.version !== strictVersion)) {
    throw new Error(`Invalid CAR version: ${block.version}${strictVersion !== undefined ? ` (expected ${strictVersion})` : ''}`)
  }
  if (block.version === 1) {
    // CarV1HeaderOrV2Pragma makes roots optional, let's make it mandatory
    if (!Array.isArray(block.roots)) {
      throw new Error('Invalid CAR header format')
    }
    return block
  }
  // version 2
  if (block.roots !== undefined) {
    throw new Error('Invalid CAR header format')
  }
  const v2Header = decodeV2Header(await reader.exactly(V2_HEADER_LENGTH, true))
  reader.seek(v2Header.dataOffset - reader.pos)
  const v1Header = await readHeader(reader, 1, limits)
  return Object.assign(v1Header, v2Header)
}

/**
 * @param {BytesReader} reader
 * @param {number} sectionLength
 * @returns {Promise<{ cid: CID, cidLength: number }>}
 */
async function readCid (reader, sectionLength) {
  const cidStart = reader.pos
  const first = await reader.exactly(2, false)
  if (first[0] === CIDV0_BYTES.SHA2_256 && first[1] === CIDV0_BYTES.LENGTH) {
    // cidv0: 0x12 code byte + 0x20 length byte + 32-byte sha2-256 digest
    const cidLength = 34
    if (cidLength > sectionLength) {
      throw new Error(`Invalid CAR section (CID of length ${cidLength} exceeds section length ${sectionLength})`)
    }
    const bytes = await reader.exactly(cidLength, true)
    return { cid: CID.create(0, CIDV0_BYTES.DAG_PB, Digest.decode(bytes)), cidLength }
  }

  const version = decodeVarint(await reader.upTo(8), reader)
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`)
  }
  const codec = decodeVarint(await reader.upTo(8), reader)
  const { mhLength, digestLength } = getMultihashLength(await reader.upTo(8))
  if (digestLength > MAX_DIGEST_ALLOC) {
    throw new RangeError(`CID digest of length ${digestLength} exceeds maximum of ${MAX_DIGEST_ALLOC}`)
  }
  const cidLength = Number(reader.pos - cidStart) + mhLength
  if (cidLength > sectionLength) {
    throw new Error(`Invalid CAR section (CID of length ${cidLength} exceeds section length ${sectionLength})`)
  }
  const bytes = await reader.exactly(mhLength, true)
  return { cid: CID.create(version, codec, Digest.decode(bytes)), cidLength }
}

/**
 * Reads the leading data of an individual block from CAR data from a
 * `BytesReader`. Returns a `BlockHeader` object which contains
 * `{ cid, length, blockLength }` which can be used to either index the block
 * or read the block binary data.
 *
 * @name async decoder.readBlockHead(reader)
 * @param {BytesReader} reader
 * @param {CarLimits} limits
 * @returns {Promise<BlockHeader>}
 */
export async function readBlockHead (reader, limits) {
  // length includes a CID + Binary, where CID has a variable length
  // we have to deal with
  const start = reader.pos
  const sectionLength = decodeVarint(await reader.upTo(8), reader)
  if (sectionLength === 0) {
    throw new Error('Invalid CAR section (zero length)')
  }
  if (sectionLength > limits.maxAllowedSectionSize) {
    throw new RangeError(`CAR section of length ${sectionLength} exceeds maxAllowedSectionSize of ${limits.maxAllowedSectionSize}`)
  }
  const length = Number(reader.pos - start) + sectionLength
  const { cid, cidLength } = await readCid(reader, sectionLength)
  return { cid, length, blockLength: sectionLength - cidLength }
}

/**
 * @param {BytesReader} reader
 * @param {CarLimits} limits
 * @returns {Promise<Block>}
 */
async function readBlock (reader, limits) {
  const { cid, blockLength } = await readBlockHead(reader, limits)
  const bytes = await reader.exactly(blockLength, true)
  return { bytes, cid }
}

/**
 * @param {BytesReader} reader
 * @param {CarLimits} limits
 * @returns {Promise<BlockIndex>}
 */
async function readBlockIndex (reader, limits) {
  const offset = reader.pos
  const { cid, length, blockLength } = await readBlockHead(reader, limits)
  const index = { cid, length, blockLength, offset, blockOffset: reader.pos }
  reader.seek(index.blockLength)
  return index
}

/**
 * Creates a `CarDecoder` from a `BytesReader`. The `CarDecoder` is as async
 * interface that will consume the bytes from the `BytesReader` to yield a
 * `header()` and either `blocks()` or `blocksIndex()` data.
 *
 * @name decoder.createDecoder(reader)
 * @param {BytesReader} reader
 * @param {CarCodecOptions} [options]
 * @returns {CarDecoder}
 */
export function createDecoder (reader, options) {
  const limits = resolveLimits(options)
  const headerPromise = (async () => {
    const header = await readHeader(reader, undefined, limits)
    if (header.version === 2) {
      const v1length = reader.pos - header.dataOffset
      reader = limitReader(reader, header.dataSize - v1length)
    }
    return header
  })()

  return {
    header: () => headerPromise,

    async * blocks () {
      await headerPromise
      while ((await reader.upTo(8)).length > 0) {
        yield await readBlock(reader, limits)
      }
    },

    async * blocksIndex () {
      await headerPromise
      while ((await reader.upTo(8)).length > 0) {
        yield await readBlockIndex(reader, limits)
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
      const out = bytes.subarray(pos, pos + Math.min(length, bytes.length - pos))
      return out
    },

    async exactly (length, seek = false) {
      if (length > bytes.length - pos) {
        throw new Error('Unexpected end of data')
      }
      const out = bytes.subarray(pos, pos + length)
      if (seek) {
        pos += length
      }
      return out
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
 * reusable reader for streams and files, we just need a way to read an
 * additional chunk (of some undetermined size) and a way to close the
 * reader when finished
 *
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
    const bufa = /** @type {Uint8Array<ArrayBufferLike>[]} */([currentChunk.subarray(offset)])
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
    },

    async exactly (length, seek = false) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      if (currentChunk.length - offset < length) {
        throw new Error('Unexpected end of data')
      }
      const out = currentChunk.subarray(offset, offset + length)
      if (seek) {
        pos += length
        offset += length
      }
      return out
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
    },

    async exactly (length, seek = false) {
      const bytes = await reader.exactly(length, seek)
      if (bytes.length + bytesRead > byteLimit) {
        throw new Error('Unexpected end of data')
      }
      if (seek) {
        bytesRead += length
      }
      return bytes
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
