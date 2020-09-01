import varint from 'varint'

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

async function readHeader (multiformats, reader) {
  const length = await readVarint(reader)
  const header = await reader.exactly(length)
  reader.seek(length)
  return multiformats.decode(header, 'dag-cbor')
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

async function readCid (multiformats, reader) {
  const first = await reader.exactly(2)
  if (first[0] === CIDV0_BYTES.SHA2_256 && first[1] === CIDV0_BYTES.LENGTH) {
    // cidv0 32-byte sha2-256
    const bytes = await reader.exactly(34)
    reader.seek(34)
    return multiformats.CID.create(0, CIDV0_BYTES.DAG_PB, Uint8Array.from(bytes))
  }

  const version = await readVarint(reader)
  if (version !== 1) {
    throw new Error(`Unexpected CID version (${version})`)
  }
  const codec = await readVarint(reader)
  const multihash = await readMultihash(reader)
  return multiformats.CID.create(version, codec, Uint8Array.from(multihash))
}

async function readBlockHead (multiformats, reader) {
  // length includes a CID + Binary, where CID has a variable length
  // we have to deal with
  const start = reader.pos
  const length = await readVarint(reader) + (reader.pos - start)
  const cid = await readCid(multiformats, reader)
  const blockLength = length - (reader.pos - start) // subtract CID length

  return { cid, length, blockLength }
}

async function readBlock (multiformats, reader) {
  const { cid, blockLength } = await readBlockHead(multiformats, reader)
  const binary = await reader.exactly(blockLength)
  reader.seek(blockLength)
  return { cid, binary }
}

async function readBlockIndex (multiformats, reader) {
  const offset = reader.pos
  const head = await readBlockHead(multiformats, reader)
  head.offset = offset
  head.blockOffset = reader.pos
  reader.seek(head.blockLength)
  return head
}

function Decoder (multiformats, reader) {
  const headerPromise = readHeader(multiformats, reader)
  function blockReader (index) {
    return async function * blockIterator () {
      await headerPromise
      try {
        while ((await reader.upTo(8)).length > 0) {
          yield await (index ? readBlockIndex(multiformats, reader) : readBlock(multiformats, reader))
        }
      } finally {
        await reader.close()
      }
    }
  }
  return {
    header: () => headerPromise,
    blocks: blockReader(),
    blocksIndex: blockReader(true)
  }
}

async function decode (multiformats, reader) {
  const decoder = Decoder(multiformats, reader)
  const header = await decoder.header()
  const decoded = {
    version: header.version,
    roots: header.roots,
    blocks: []
  }
  for await (const block of decoder.blocks()) {
    decoded.blocks.push(block)
  }
  return decoded
}

export { Decoder, decode }
