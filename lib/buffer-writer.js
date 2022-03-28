import varint from "varint"
import * as CBOR from "@ipld/dag-cbor"

// Number of bytes required without any roots
const EMPTY_HEADER_SIZE = 17
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

export class CarBufferWriter {
  /**
   * @param {Uint8Array} bytes
   * @param {number} byteOffset
   * @param {CID[]} roots
   */
  constructor (bytes, byteOffset, roots = []) {
    this.bytes = bytes
    /** @private */
    this.byteOffset = byteOffset
    /** @private */
    this.roots = roots
    /** @private */
    this.headerCapacty = byteOffset
  }

  /**
   * @param {CID} root
   */
  addRoot (root) {
    const byteLength = root.bytes.byteLength + ROOT_EXTRA_SIZE
    if (byteLength > this.headerCapacty - EMPTY_HEADER_SIZE) {
      throw new RangeError('Root will not fit')
    }
    this.roots.push(root)
    this.headerCapacty -= byteLength
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

  close () {
    const { roots } = this
    const headerBytes = CBOR.encode({ version: 1, roots })
    const varintBytes = varint.encode(headerBytes.length)

    const headerByteLength = varintBytes.length + headerBytes.byteLength
    const offset = this.headerCapacty - headerByteLength

    if (offset >= 0) {
      this.bytes.set(varintBytes, offset)
      this.bytes.set(headerBytes, offset + varintBytes.length)

      return this.bytes.subarray(offset, this.byteOffset)
    } else if (this.bytes.byteLength + offset - this.byteOffset > 0) {
      // Slide blocks by an offset
      this.byteOffset -= offset
      this.bytes.set(this.bytes.subarray(this.headerCapacty), this.byteOffset)
      this.bytes.set(varintBytes, 0)
      this.bytes.set(headerBytes, varintBytes.length)
      return this.bytes.subarray(0, this.byteOffset)
    } else {
      throw new RangeError('Header does not fit')
    }
  }
}

/**
 * @param {number} count - Number of roots
 * @param {number} [capacity] - Total byteLength of allroots
 */
export const estimateHeaderCapacity = (
  count,
  capacity = count * DEFAULT_CID_SIZE
) => {
  // Number of bytes added per root
  const rootsSize = count * ROOT_EXTRA_SIZE
  const headerSize = capacity + rootsSize + EMPTY_HEADER_SIZE
  const varintSize = varint.encodingLength(headerSize)
  return varintSize + headerSize
}

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
    headerCapacity = estimateHeaderCapacity(
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
