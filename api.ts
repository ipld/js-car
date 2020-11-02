import CID from 'multiformats/cid'

/* Generic types for interfacing with block storage */

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

export interface BlockIterator {
  blocks(): AsyncGenerator<Block>
  cids(): AsyncGenerator<CID>
}

export interface BlockReader {
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

/* Specific implementations for CAR block storage */

export interface CarIterator extends BlockIterator, RootsReader {}
export interface CarReader extends CarIterator, BlockReader {}
export interface CarWriter extends BlockWriter {}
export interface CarIndexer extends AsyncIterable<BlockIndex> {}
