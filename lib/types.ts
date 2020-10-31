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

export interface NodeBlockReader extends BlockReader {
//  static readRaw(fd: fs.promises.FileHandle | number, blockIndex: BlockIndex): Promise<Block>
}

export interface BlockWriter {
  put(block: Block): Promise<void>

  close(): Promise<void>
}

export interface WriterChannel {
  writer: BlockWriter

  out: AsyncIterable<Uint8Array>
}

// export interface CarIndexer extends RootsReader, AsyncIterable<BlockIndex> {}

export interface CarEncoder {
  setRoots(roots: CID[]): Promise<void>

  writeBlock(block: Block): Promise<void>

  close(): Promise<void>
}

export type CarHeader = { version: number, roots: CID[] }

export interface CarDecoder {
  header(): Promise<CarHeader>

  blocks(): AsyncGenerator<Block>

  blocksIndex(): AsyncGenerator<BlockIndex>
}

export interface BytesReader {
  upTo(length: number): Promise<Uint8Array>

  exactly(length: number): Promise<Uint8Array>

  seek(length: number): void

  pos: number
}
