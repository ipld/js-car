import varint from 'varint'
import * as CBOR from '@ipld/dag-cbor'

// Number of bytes required without any roots.
const EMPTY_HEADER_SIZE = 16
// Number of bytes used for CIDv1 with sha256 digest
const DEFAULT_CID_SIZE = 36
// Number of bytes added per root
const ROOT_EXTRA_SIZE = 5

/**
 * @typedef {import('../api').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').CarBufferWriter} Writer
 * @typedef {import('../api').CarBufferWriterOptions} Options
 * @typedef {import('./coding').CarEncoder} CarEncoder
 */


/**
 * @implements {Writer}
 */
class CarBufferWriter {
  /**
   * @param {Uint8Array} bytes
   * @param {number} byteOffset
   * @param {CID[]} roots
   */
  constructor (bytes, byteOffset, roots = []) {
    /** @readonly */
    this.bytes = bytes
    /** @readonly */
    this.roots = roots
    this.byteOffset = byteOffset
    this.headerCapacity = byteOffset
  }

  /**
   * @param {CID} root
   */
  addRoot (root) {
    const byteLength = root.bytes.byteLength + ROOT_EXTRA_SIZE
    if (byteLength > this.headerCapacity - EMPTY_HEADER_SIZE) {
      throw new RangeError('Root will not fit')
    }
    this.roots.push(root)
    this.headerCapacity -= byteLength
  }

  /**
   * Write a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) to the archive.
   * Throws if there is not enough capacity.
   *
   * @param {Block} block A `{ cid:CID, bytes:Uint8Array }` pair.
   */
  write ({ cid, bytes }) {
    const size = varint.encode(cid.bytes.length + bytes.length)
    const byteLength = size.length + cid.bytes.byteLength + bytes.byteLength
    if (this.byteOffset + byteLength > this.bytes.byteLength) {
      throw new RangeError('Buffer overflow')
    } else {
      this.bytes.set(size, this.byteOffset)
      this.byteOffset += size.length

      this.bytes.set(cid.bytes, this.byteOffset)
      this.byteOffset += cid.bytes.byteOffset

      this.bytes.set(bytes, this.byteOffset)
      this.byteOffset += bytes.byteLength
    }
  }

  /**
   * @param {object} options
   * @param {boolean} options.align
   */
  close ({align = false}) {
    const { roots, bytes, byteOffset, headerCapacity } = this
    const headerBytes = CBOR.encode({ version: 1, roots })
    const varintBytes = varint.encode(headerBytes.length)

    const headerByteLength = varintBytes.length + headerBytes.byteLength
    const offset = headerCapacity - headerByteLength

    if (offset === 0) {
      writeHeader(varintBytes, headerBytes, bytes)
      return bytes.subarray(0, byteOffset)
    } 
    // If header was misestimated, yet buffer has capacity to fit header and
    // written blocks
    else if (byteOffset + offset < bytes.byteLength) {
      // If we `align: true` is passed we will align header & blocks as needed.
      if (align) {
        this.byteOffset += offset
        // Move encoded blocks to a new offset. Please note that we may have
        // underestimated header so this needs to happen before we write header.
        bytes.set(bytes.subarray(headerCapacity, byteOffset), headerByteLength)

        writeHeader(varintBytes, headerBytes, bytes)
        return bytes.subarray(0, this.byteOffset)
      } else {
        throw new RangeError(

          `Header size was ${offset > 0 ? `underestimated by ${offset}` : `overestimated by ${-1 * offset}`}
You can use close({ align: true }) to align header and blocks as needed`)
      }
    } else {
      throw new RangeError(`Header size was underestimated by ${-1 * offset} bytes and there is not enough space in the buffer now`)
    }
  }
}

/**
 * 
 * @param {CarBufferWriter} writer 
 */
const close = ({ bytes, roots, headerCapacity }) => {
  const headerBytes = CBOR.encode({ version: 1, roots })
  const varintBytes = varint.encode(headerBytes.length)
  const byteLength = varintBytes.length + headerBytes.byteLength
  const offset = headerCapacity - byteLength
  if (offset === 0) {
    writeHeader(varintBytes, headerBytes, bytes)
  } else if (offset > 0) {
    throw new RangeError(`Header size was underestimated as ${headerCapacity} which is less than actual byteLength of ${byteLength}`)
  } else {
    throw new RangeError(`Header size was overestimated as ${headerCapacity} which is greater than actual byteLength of ${byteLength}`)
  }
}




/**
 * 
 * @param {number[]} varint 
 * @param {Uint8Array} header 
 * @param {Uint8Array} destination 
 * @param {number} offset 
 */
const writeHeader = (varint, header, destination, offset=0) => {
  destination.set(varint, offset)
  destination.set(header, offset + varint.length)
}

/**
 * 
 * @param {Uint8Array} bytes
 * @param {number} newOffset
 * @param {number} byteOffset
 * @param {number} byteLength
 */
const slide = (bytes, newOffset, byteOffset, byteLength=bytes.byteLength) => {
  bytes.set(bytes.subarray(byteOffset, byteLength), newOffset)
}
/**
 * Attempts to estimate header size given number of roots it will have assuming
 * they're CIDv1 in with sha256 digest. Optionally it takes number of bytes
 * to be allocated for all the roots, in case different hashing or CID version
 * is used.
 * 
 * Note: Returned value is just an estimate which can be inaccurate where large
 * number of CIDs is passed or if they are of various sizes.
 * 
 * @param {number} count - Number of roots
 * @param {number} [rootsByteLength] - Total byteLength of all roots
 */
export const estimateHeaderSize = (
  count,
  rootsByteLength = count * DEFAULT_CID_SIZE
) => {
  const lengthSize = arrayLengthEncodeSize(count)
  const rootsSize = rootsByteLength + count * ROOT_EXTRA_SIZE
  const headerSize = EMPTY_HEADER_SIZE + lengthSize + rootsSize
  const varintSize = varint.encodingLength(headerSize)
  return varintSize + headerSize
}

/**
 * 
 * @param {number} length 
 * @returns 
 */
const arrayLengthEncodeSize = length =>
  length < 24 ? 1 :
  length < 256 ? 2 :
  length < 65536 ? 3 :
  CBOR.encode(length).length

/**
 * @param {CID[]} cids
 */
const totalByteLength = (cids) => {
  let total = 0
  for (const cid of cids) {
    total += cid.bytes.byteLength
  }
  return total
}

/**
 * Creates synchronous CAR writer that can be used to encode blocks into a given
 * buffer. Optionally you could pass `byteOffset` and `byteLength` to specify a
 * range inside buffer to write into. If car file is going to have `roots` you
 * need to either pass them under `options.roots` or provide `options.headerCapacity`
 * to allocate required space for the header (You can use `estimateHeaderCapacity`
 * function to get an estimate). It is also possible to provide both `roots`
 * and `headerCapacity` to allocate space for the roots that may not be known
 * ahead of time.
 *
 * Note: Incorrect header estimate may lead to copying bytes inside a buffer
 * which will have a negative impact on performance.
 *
 * @param {ArrayBuffer} buffer
 * @param {Options} [options]
 * @returns {Writer}
 */
export const createWriter = (
  buffer,
  {
    roots = [],
    byteOffset = 0,
    byteLength = buffer.byteLength,
    headerCapacity = estimateHeaderSize(
      roots.length,
      totalByteLength(roots)
    )
  } = {}
) => {
  const bytes = new Uint8Array(buffer, byteOffset, byteLength)

  const writer = new CarBufferWriter(bytes, headerCapacity)
  for (const root of roots) {
    writer.addRoot(root)
  }

  return writer
}
