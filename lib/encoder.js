// @ts-ignore
import varint from 'varint'
// @ts-ignore
import { encode as dagCborEncode } from '@ipld/dag-cbor'

/**
 * @typedef {import('multiformats').CID} CID
 * @typedef {import('../api').Block} Block
 * @typedef {import('./coding').CarEncoder} CarEncoder
 */

/**
 * @param {function(Uint8Array):Promise<void>} writeCb
 * @param {function():Promise<void>} closeCb
 * @returns {CarEncoder}
 */
function createEncoder (writeCb, closeCb) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    /**
     * @param {CID[]} roots
     * @returns {Promise<void>}
     */
    async setRoots (roots) {
      const header = dagCborEncode({ version: 1, roots })
      await writeCb(new Uint8Array(varint.encode(header.length)))
      await writeCb(header)
    },

    /**
     * @param {Block} block
     * @returns {Promise<void>}
     */
    async writeBlock (block) {
      const { cid, bytes } = block
      await writeCb(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writeCb(cid.bytes)
      await writeCb(bytes)
    },

    /**
     * @returns {Promise<void>}
     */
    async close () {
      return closeCb()
    }
  }
}

export { createEncoder }
