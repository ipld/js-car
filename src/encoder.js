import { encode as dagCborEncode } from '@ipld/dag-cbor'
import varint from 'varint'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./coding.js').CarEncoder} CarEncoder
 * @typedef {import('./coding.js').IteratorChannel_Writer<Uint8Array>} IteratorChannel_Writer
 */

const CAR_V1_VERSION = 1

/**
 * Create a header from an array of roots.
 *
 * @param {CID[]} roots
 * @returns {Uint8Array}
 */
export function createHeader (roots) {
  const headerBytes = dagCborEncode({ version: CAR_V1_VERSION, roots })
  const varintBytes = varint.encode(headerBytes.length)
  const header = new Uint8Array(varintBytes.length + headerBytes.length)
  header.set(varintBytes, 0)
  header.set(headerBytes, varintBytes.length)
  return header
}

/**
 * @param {IteratorChannel_Writer} writer
 * @returns {CarEncoder}
 */
function createEncoder (writer) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    /**
     * @param {CID[]} roots
     * @returns {Promise<void>}
     */
    async setRoots (roots) {
      const bytes = createHeader(roots)
      await writer.write(bytes)
    },

    /**
     * @param {Block} block
     * @returns {Promise<void>}
     */
    async writeBlock (block) {
      const { cid, bytes } = block
      await writer.write(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
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
