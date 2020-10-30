import varint from 'varint'
import * as dagCbor from '@ipld/dag-cbor'

function createEncoder (writeCb, closeCb) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    // assumes array of proper CID objects
    async setRoots (roots) {
      const header = dagCbor.encode({ version: 1, roots })
      await writeCb(new Uint8Array(varint.encode(header.length)))
      await writeCb(header)
    },

    // assumes a proper Block object
    async writeBlock (block) {
      const { cid, bytes } = block
      await writeCb(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writeCb(cid.bytes)
      await writeCb(bytes)
    },

    close () {
      return closeCb()
    }
  }
}

export { createEncoder }
