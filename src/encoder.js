import { encode as dagCborEncode } from '@ipld/dag-cbor'
import varint from 'varint'
import { DEFAULT_MAX_ALLOWED_HEADER_SIZE, assertDigestSize, assertHeaderSize, assertSectionSize, resolveLimits } from './limits.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./coding.js').CarEncoder} CarEncoder
 * @typedef {import('./coding.js').IteratorChannel_Writer<Uint8Array>} IteratorChannel_Writer
 * @typedef {import('./api.js').CarCodecOptions} CarCodecOptions
 */

const CAR_V1_VERSION = 1

/**
 * Create a header from an array of roots.
 *
 * @param {CID[]} roots
 * @param {number} [maxAllowedHeaderSize]
 * @returns {Uint8Array}
 */
export function createHeader (roots, maxAllowedHeaderSize = DEFAULT_MAX_ALLOWED_HEADER_SIZE) {
  const headerBytes = dagCborEncode({ version: CAR_V1_VERSION, roots })
  assertHeaderSize(headerBytes.length, maxAllowedHeaderSize)
  const varintBytes = varint.encode(headerBytes.length)
  const header = new Uint8Array(varintBytes.length + headerBytes.length)
  header.set(varintBytes, 0)
  header.set(headerBytes, varintBytes.length)
  return header
}

/**
 * Encode a block as the chunks of a CAR section: the varint section length,
 * the CID bytes and, unless empty, the block bytes.
 *
 * @param {Block} block
 * @param {number} maxAllowedSectionSize
 * @returns {Uint8Array[]}
 */
export function encodeSection ({ cid, bytes }, maxAllowedSectionSize) {
  const sectionLength = cid.bytes.length + bytes.length
  assertSectionSize(sectionLength, maxAllowedSectionSize)
  assertDigestSize(cid.multihash.size)
  /** @type {Uint8Array[]} */
  const chunks = [new Uint8Array(varint.encode(sectionLength)), cid.bytes]
  if (bytes.length) {
    // skip the empty chunk for zero-length blocks
    chunks.push(bytes)
  }
  return chunks
}

/**
 * @param {IteratorChannel_Writer} writer
 * @param {CarCodecOptions} [options]
 * @returns {CarEncoder}
 */
function createEncoder (writer, options) {
  const { maxAllowedHeaderSize, maxAllowedSectionSize } = resolveLimits(options)

  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    /**
     * @param {CID[]} roots
     * @returns {Promise<void>}
     */
    async setRoots (roots) {
      const bytes = createHeader(roots, maxAllowedHeaderSize)
      await writer.write(bytes)
    },

    /**
     * @param {Block} block
     * @returns {Promise<void>}
     */
    async writeBlock (block) {
      for (const chunk of encodeSection(block, maxAllowedSectionSize)) {
        await writer.write(chunk)
      }
    },

    /**
     * @returns {Promise<void>}
     */
    async close () {
      await writer.end()
    },

    /**
     * @param {Error} err
     * @returns {void}
     */
    error (err) {
      writer.error(err)
    },

    /**
     * @returns {number}
     */
    version () {
      return CAR_V1_VERSION
    }
  }
}

export { createEncoder }
