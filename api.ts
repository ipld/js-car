import CID from 'multiformats/cid'

export type Block = { cid: CID, bytes: Uint8Array }

export type BlockHeader = {
  cid: CID,
  length: number,
  blockLength: number
}

export type BlockIndex = BlockHeader & {
  offset: number,
  blockOffset: number
}

export interface RootsReader {
  getRoots(): Promise<CID[]>
}

export interface BlockIterator extends RootsReader {
  blocks(): AsyncGenerator<Block>

  cids(): AsyncGenerator<CID>
}

export interface BlockReader extends BlockIterator {
  has(key: CID): Promise<boolean>

  get(key: CID): Promise<Block | undefined>
}

export interface BlockWriter {
  put(block: Block): Promise<void>

  close(): Promise<void>
}

export interface WriterChannel {
  writer: BlockWriter

  out: AsyncIterable<Uint8Array>
}
