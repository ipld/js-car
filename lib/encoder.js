import varint from 'varint'

function Encoder (Block, writeCb) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  const { CID } = Block.multiformats
  return {
    async setRoots (roots) {
      for (let i = 0; i < roots.length; i++) {
        roots[i] = CID.asCID(roots[i])
        if (!roots[i]) {
          throw new TypeError('Roots must be CIDs') // or gently coercable to CIDs
        }
      }

      const header = Block.encoder({ version: 1, roots }, 'dag-cbor').encode()
      await writeCb(new Uint8Array(varint.encode(header.length)))
      await writeCb(header)
    },

    async writeBlock (block) {
      if (typeof block.encode !== 'function' || typeof block.cid !== 'function') {
        throw new TypeError('Can only write Block objects')
      }
      const bytes = block.encode()
      const cid = await block.cid()
      await writeCb(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writeCb(cid.bytes)
      await writeCb(bytes)
    }
  }
}

export { Encoder }
