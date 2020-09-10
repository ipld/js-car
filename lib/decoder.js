import varint from 'varint'
import { StoreReader } from './storage.js'

const CIDV0_BYTES = {
  SHA2_256: 0x12,
  LENGTH: 0x20,
  DAG_PB: 0x70
}

async function readVarint (reader) {
  const bytes = await reader.upTo(8)
  const i = varint.decode(bytes)
  reader.seek(varint.decode.bytes)
  return i
}

async function readHeader (Block, reader) {
  const length = await readVarint(reader)
  const header = await reader.exactly(length)
  reader.seek(length)
  return Block.decoder(header, 'dag-cbor')
}

async function readMultihash (reader) {
  // | code | length | .... |
  // where both code and length are varints, so we have to decode
  // them first before we can know total length

  const bytes = await reader.upTo(8)
  varint.decode(bytes) // code
  const codeLength = varint.decode.bytes
  const length = varint.decode(bytes.slice(varint.decode.bytes))
  const lengthLength = varint.decode.bytes
  const mhLength = codeLength + lengthLength + length
  const multihash = await reader.exactly(mhLength)
  reader.seek(mhLength)
  return multihash
}

async function readCid (Block, reader) {
  const first = await reader.exactly(2)
  if (first[0] === CIDV0_BYTES.SHA2_256 && first[1] === CIDV0_BYTES.LENGTH) {
    // cidv0 32-byte sha2-256
    const bytes = await reader.exactly(34)
    reader.seek(34)
    return Block.multiformats.CID.create(0, CIDV0_BYTES.DAG_PB, Uint8Array.from(bytes))
  }

  const version = await readVarint(reader)
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`)
  }
  const codec = await readVarint(reader)
  const multihash = await readMultihash(reader)
  return Block.multiformats.CID.create(version, codec, Uint8Array.from(multihash))
}

async function readBlockHead (Block, reader) {
  // length includes a CID + Binary, where CID has a variable length
  // we have to deal with
  const start = reader.pos
  const length = await readVarint(reader) + (reader.pos - start)
  const cid = await readCid(Block, reader)
  const blockLength = length - (reader.pos - start) // subtract CID length

  return { cid, length, blockLength }
}

async function readBlock (Block, reader) {
  const { cid, blockLength } = await readBlockHead(Block, reader)
  const binary = await reader.exactly(blockLength)
  reader.seek(blockLength)
  return Block.create(binary, cid)
}

/*
async function readBlockIndex (Block, reader) {
  const offset = reader.pos
  const head = await readBlockHead(Block, reader)
  head.offset = offset
  head.blockOffset = reader.pos
  reader.seek(head.blockLength)
  return head
}
*/

function Decoder (Block, reader) {
  const headerPromise = readHeader(Block, reader)
  function blockReader (/* index */) {
    return async function * blockIterator () {
      await headerPromise
      try {
        while ((await reader.upTo(8)).length > 0) {
          yield await readBlock(Block, reader)
          // yield await (index ? readBlockIndex(Block, reader) : readBlock(Block, reader))
        }
      } finally {
        // await reader.close()
      }
    }
  }
  return {
    header: () => headerPromise,
    blocks: blockReader()
    // blocksIndex: blockReader(true)
  }
}

async function decodeComplete (Block, reader) {
  const decoder = Decoder(Block, reader)
  const { version, roots } = (await decoder.header()).decode()
  const blocks = []
  for await (const block of decoder.blocks()) {
    blocks.push(block)
  }

  return new StoreReader(version, roots, blocks)
}

function bytesReader (bytes) {
  let pos = 0

  return {
    async upTo (length) {
      return bytes.slice(pos, pos + Math.min(length, bytes.length - pos))
    },

    async exactly (length) {
      if (length > bytes.length - pos) {
        throw new Error('Unexpected end of data')
      }
      return bytes.slice(pos, pos + length)
    },

    seek (length) {
      pos += length
    },

    get pos () {
      return pos
    }
  }
}

// reusable reader for streams and files, we just need a way to read an
// additional chunk (of some undetermined size) and a way to close the
// reader when finished
function chunkReader (readChunk /*, closer */) {
  let pos = 0
  let have = 0
  let offset = 0
  let currentChunk = new Uint8Array(0)

  const read = async (length) => {
    have = currentChunk.length - offset
    const bufa = [currentChunk.slice(offset)]
    while (have < length) {
      const chunk = await readChunk()
      if (chunk.length === 0) {
        break
      }
      /* c8 ignore next 8 */
      // undo this ignore ^ when we have a fd implementation that can seek()
      if (have < 0) { // because of a seek()
        /* c8 ignore next 4 */
        // toohard to test the else
        if (chunk.length > have) {
          bufa.push(chunk.slice(-have))
        } // else discard
      } else {
        bufa.push(chunk)
      }
      have += chunk.length
    }
    currentChunk = new Uint8Array(bufa.reduce((p, c) => p + c.length, 0))
    let off = 0
    for (const b of bufa) {
      currentChunk.set(b, off)
      off += b.length
    }
    offset = 0
  }

  return {
    async upTo (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      return currentChunk.slice(offset, offset + Math.min(currentChunk.length - offset, length))
    },

    async exactly (length) {
      if (currentChunk.length - offset < length) {
        await read(length)
      }
      if (currentChunk.length - offset < length) {
        throw new Error('Unexpected end of data')
      }
      return currentChunk.slice(offset, offset + length)
    },

    seek (length) {
      pos += length
      offset += length
    },

    get pos () {
      return pos
    } /* ,

    close () {
      // return closer && closer()
    } */
  }
}

function asyncIterableReader (asyncIterable) {
  const iterator = asyncIterable[Symbol.asyncIterator]()

  async function readChunk () {
    const next = await iterator.next()
    if (next.done) {
      return new Uint8Array(0)
    }
    return next.value
  }

  return chunkReader(readChunk)
}
export { decodeComplete, bytesReader, asyncIterableReader }
