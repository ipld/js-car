import type { CID } from 'multiformats/cid'

export type { CID }
/* Generic types for interfacing with block storage */

export interface Block {
  cid: CID
  bytes: Uint8Array
}

export interface BlockHeader {
  cid: CID
  length: number
  blockLength: number
}

export interface BlockIndex extends BlockHeader {
  offset: number
  blockOffset: number
}

export interface RootsReader {
  version: number
  getRoots: () => Promise<CID[]>
}

export interface BlockIterator extends AsyncIterable<Block> {}

export interface CIDIterator extends AsyncIterable<CID> {}

export interface BlockReader {
  has: (key: CID) => Promise<boolean>
  get: (key: CID) => Promise<Block | undefined>
  blocks: () => BlockIterator
  cids: () => CIDIterator
}

export interface BlockWriter {
  put: (block: Block) => Promise<void>
  close: () => Promise<void>
}

export interface CarBufferWriter {
  addRoot: (root: CID, options?: { resize?: boolean }) => CarBufferWriter
  write: (block: Block) => CarBufferWriter
  close: (options?: { resize?: boolean }) => Uint8Array
}

export interface CarBufferWriterOptions {
  roots?: CID[] // defaults to []
  byteOffset?: number // defaults to 0
  byteLength?: number // defaults to buffer.byteLength

  headerSize?: number // defaults to size needed for provided roots
}

export interface WriterChannel {
  writer: BlockWriter
  out: AsyncIterable<Uint8Array>
}

export interface CarReader extends BlockReader, RootsReader {}

/* Specific implementations for CAR block storage */

/*
export interface CarBlockIterator extends BlockIterator, RootsReader {}
export interface CarCIDIterator extends CIDIterator, RootsReader {}
export interface CarIndexer extends AsyncIterable<BlockIndex>, RootsReader {}
export interface CarWriter extends BlockWriter {}
*/