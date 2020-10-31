// @ts-ignore
import varint from 'varint'
// @ts-ignore
import { encode as dagCborEncode } from '@ipld/dag-cbor'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('./coding').CarEncoder} CarEncoder
 * @typedef {import('./coding').IteratorChannel_Writer<Uint8Array>} IteratorChannel_Writer
 */

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
      const header = dagCborEncode({ version: 1, roots })
      await writer.write(new Uint8Array(varint.encode(header.length)))
      await writer.write(header)
    },

    /**
     * @param {Block} block
     * @returns {Promise<void>}
     */
    async writeBlock (block) {
      const { cid, bytes } = block
      await writer.write(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writer.write(cid.bytes)
      await writer.write(bytes)
    },

    /**
     * @returns {Promise<void>}
     */
    async close () {
      return writer.end()
    }
  }
}

export { createEncoder }
