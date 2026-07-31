import { encode as dagCborEncode } from '@ipld/dag-cbor'
import varint from 'varint'
import { resolveLimits } from './limits.js'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./coding.js').CarEncoder} CarEncoder
 * @typedef {import('./coding.js').IteratorChannel_Writer<Uint8Array>} IteratorChannel_Writer
 * @typedef {import('./limits.js').CarLimits} CarLimits
 */

const CAR_V1_VERSION = 1

/**
 * Create a header from an array of roots.
 *
 * @param {CID[]} roots
 * @param {CarLimits} [limits]
 * @returns {Uint8Array}
 */
export function createHeader (roots, limits = resolveLimits()) {
  const headerBytes = dagCborEncode({ version: CAR_V1_VERSION, roots })
  if (headerBytes.length > limits.maxAllowedHeaderSize) {
    throw new RangeError(`CAR header of length ${headerBytes.length} exceeds maxAllowedHeaderSize of ${limits.maxAllowedHeaderSize}`)
  }
  const varintBytes = varint.encode(headerBytes.length)
  const header = new Uint8Array(varintBytes.length + headerBytes.length)
  header.set(varintBytes, 0)
  header.set(headerBytes, varintBytes.length)
  return header
}

/**
 * @param {IteratorChannel_Writer} writer
 * @param {CarLimits} limits
 * @returns {CarEncoder}
 */
function createEncoder (writer, limits) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    /**
     * @param {CID[]} roots
     * @returns {Promise<void>}
     */
    async setRoots (roots) {
      const bytes = createHeader(roots, limits)
      await writer.write(bytes)
    },

    /**
     * @param {Block} block
     * @returns {Promise<void>}
     */
    async writeBlock (block) {
      const { cid, bytes } = block
      const sectionLength = cid.bytes.length + bytes.length
      if (sectionLength > limits.maxAllowedSectionSize) {
        throw new RangeError(`CAR section of length ${sectionLength} exceeds maxAllowedSectionSize of ${limits.maxAllowedSectionSize}`)
      }
      await writer.write(new Uint8Array(varint.encode(sectionLength)))
      await writer.write(cid.bytes)
      if (bytes.length) {
        // zero-length blocks are valid, but it'd be safer if we didn't write them
        await writer.write(bytes)
      }
    },

    /**
     * @returns {Promise<void>}
     */
    async close () {
      await writer.end()
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
