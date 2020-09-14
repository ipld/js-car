import varint from 'varint'

function Encoder (Block, writeCb) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    // assumes array of proper CID objects
    async setRoots (roots) {
      const header = Block.encoder({ version: 1, roots }, 'dag-cbor').encode()
      await writeCb(new Uint8Array(varint.encode(header.length)))
      await writeCb(header)
    },

    // assumes a proper Block object
    async writeBlock (block) {
      const bytes = block.encode()
      const cid = await block.cid()
      await writeCb(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writeCb(cid.bytes)
      await writeCb(bytes)
    }
  }
}

export { Encoder }
