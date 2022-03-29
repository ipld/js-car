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
   * @param {number} headerSize
   */
  constructor (bytes, headerSize) {
    /** @readonly */
    this.bytes = bytes
    this.byteOffset = headerSize

    /**
     * @readonly
     * @type {CID[]}
     */
    this.roots = []
    this.headerOffset = 0
    this.headerSize = headerSize
  }

  /**
   * @param {CID} root
   * @param {{resize?:boolean}} [options]
   */
  addRoot (root, options) {
    addRoot(this, root, options)
    return this
  }

  /**
   * Write a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) to the archive.
   * Throws if there is not enough capacity.
   *
   * @param {Block} block A `{ cid:CID, bytes:Uint8Array }` pair.
   */
  write (block) {
    addBlock(this, block)
    return this
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.resize]
   */
  close (options) {
    return close(this, options)
  }
}

/**
 * @param {CarBufferWriter} writer
 * @param {CID} root
 * @param {{resize?:boolean}} [options]
 */
export const addRoot = (writer, root, { resize = false } = {}) => {
  const { bytes, headerSize, byteOffset, roots, headerOffset } = writer
  const byteLength = headerOffset + root.bytes.byteLength
  const size = estimateHeaderSize(writer.roots.length + 1, byteLength)
  // If there is a space for the new root simply add it to the array
  if (size <= headerSize) {
    roots.push(root)
    writer.headerOffset = byteLength
  // If root does not fit in the header but there is space in buffer
  } else if (size - headerSize + byteOffset < bytes.byteLength) {
    if (resize) {
      resizeHeader(writer, size)
      roots.push(root)
      writer.headerOffset = byteLength
    } else {
      throw new RangeError(`Header of size ${headerSize} has no capacity for new root ${root}.
However there is a space in the buffer and you could call addRoot(root, { resize: root }) to resize header to make a space for this root.`)
    }
  } else {
    throw new RangeError(`Buffer has no capacity for a new root ${root}`)
  }
}

/**
 * @param {CarBufferWriter} writer
 * @param {Block} block
 */
export const addBlock = (writer, { cid, bytes }) => {
  const size = varint.encode(cid.bytes.length + bytes.length)
  const byteLength = size.length + cid.bytes.byteLength + bytes.byteLength
  if (writer.byteOffset + byteLength > writer.bytes.byteLength) {
    throw new RangeError('Buffer has no capacity for this block')
  } else {
    writeBytes(writer, size)
    writeBytes(writer, cid.bytes)
    writeBytes(writer, bytes)
  }
}

/**
 * @param {CarBufferWriter} writer
 * @param {object} [options]
 * @param {boolean} [options.resize]
 */
export const close = (writer, { resize = false } = {}) => {
  const { roots, bytes, byteOffset, headerSize } = writer

  const headerBytes = CBOR.encode({ version: 1, roots })
  const varintBytes = varint.encode(headerBytes.length)

  const size = varintBytes.length + headerBytes.byteLength
  const offset = headerSize - size

  // If header size estimate was accurate we just write header and return
  // view into buffer.
  if (offset === 0) {
    writeHeader(writer, varintBytes, headerBytes)
    return bytes.subarray(0, byteOffset)
    // If header was overestimated and `{resize: true}` is passed resize header
  } else if (resize) {
    resizeHeader(writer, size)
    writeHeader(writer, varintBytes, headerBytes)
    return bytes.subarray(0, writer.byteOffset)
  } else {
    throw new RangeError(`Header size was overestimated.
You can use close({ resize: true }) to resize header`)
  }
}

/**
 *
 * @param {CarBufferWriter} writer
 * @param {number} byteLength
 */
export const resizeHeader = (writer, byteLength) => {
  const { bytes, headerSize } = writer
  // Move data section to a new offset
  bytes.set(bytes.subarray(headerSize, writer.byteOffset), byteLength)
  // Update header size & byteOffset
  writer.byteOffset += byteLength - headerSize
  writer.headerSize = byteLength
}

/**
 *
 * @param {CarBufferWriter} writer
 * @param {number[]|Uint8Array} bytes
 */

const writeBytes = (writer, bytes) => {
  writer.bytes.set(bytes, writer.byteOffset)
  writer.byteOffset += bytes.length
}
/**
 *
 * @param {{bytes:Uint8Array}} writer
 * @param {number[]} varint
 * @param {Uint8Array} header
 */
const writeHeader = ({ bytes }, varint, header) => {
  bytes.set(varint)
  bytes.set(header, varint.length)
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
  length < 24
    ? 1
    : length < 256
      ? 2
      : length < 65536
        ? 3
        : CBOR.encode(length).length

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
 * @returns {CarBufferWriter}
 */
export const createWriter = (
  buffer,
  {
    roots = [],
    byteOffset = 0,
    byteLength = buffer.byteLength,
    headerSize = estimateHeaderSize(
      roots.length,
      totalByteLength(roots)
    )
  } = {}
) => {
  const bytes = new Uint8Array(buffer, byteOffset, byteLength)

  const writer = new CarBufferWriter(bytes, headerSize)
  for (const root of roots) {
    writer.addRoot(root)
  }

  return writer
}
