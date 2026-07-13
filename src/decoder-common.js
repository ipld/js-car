import varint from 'varint'

export const CIDV0_BYTES = {
  SHA2_256: 0x12,
  LENGTH: 0x20,
  DAG_PB: 0x70
}

export const V2_HEADER_LENGTH = /* characteristics */ 16 /* v1 offset */ + 8 /* v1 size */ + 8 /* index offset */ + 8

/**
 * Decodes varint and seeks the buffer
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.upTo(8) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 * @param {import('./coding.js').Seekable} seeker
 * @returns {number}
 */
export function decodeVarint (bytes, seeker) {
  if (!bytes.length) {
    throw new Error('Unexpected end of data')
  }
  const i = varint.decode(bytes)
  seeker.seek(/** @type {number} */(varint.decode.bytes))
  return i
}

/**
 * Decode v2 header
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.exactly(V2_HEADER_LENGTH, true) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 * @returns {import('./coding.js').CarV2FixedHeader}
 */
export function decodeV2Header (bytes) {
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
  return header
}

// Matches go-cid's hardcoded, unexported maxDigestAlloc (go-cid/cid.go). Bounds
// the multihash digest length, not the whole CID.
const MAX_DIGEST_ALLOC = 32 << 20 // 32MiB

/**
 * Returns the total byte length of the multihash to be read afterwards, throwing
 * if its declared digest length exceeds the allocation bound.
 *
 * ```js
 * // needs bytes to be read first
 * const bytes = reader.upTo(8) // maybe async
 * ```
 *
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function getMultihashLength (bytes) {
  // | code | length | .... |
  // where both code and length are varints, so we have to decode
  // them first before we can know total length

  varint.decode(bytes) // code
  const codeLength = /** @type {number} */(varint.decode.bytes)
  const digestLength = varint.decode(bytes.subarray(codeLength))
  const lengthLength = /** @type {number} */(varint.decode.bytes)
  if (digestLength > MAX_DIGEST_ALLOC) {
    throw new RangeError(`CID digest of length ${digestLength} exceeds maximum of ${MAX_DIGEST_ALLOC}`)
  }
  return codeLength + lengthLength + digestLength
}
