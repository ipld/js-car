import type { CID } from 'multiformats/cid'
import type { Block, BlockIndex } from './api.js'

export interface CarEncoder {
  setRoots: (roots: CID[]) => Promise<void>

  writeBlock: (block: Block) => Promise<void>

  close: () => Promise<void>
}

export interface IteratorChannel_Writer<T> {
  write: (chunk: T) => Promise<void>
  end: () => Promise<void>
}

export interface IteratorChannel<T> {
  writer: IteratorChannel_Writer<T>

  iterator: AsyncIterator<T>
}

export interface CarHeader {
  version: 1
  roots: CID[]
}

export interface CarV2FixedHeader {
  characteristics: [bigint, bigint]
  dataOffset: number
  dataSize: number
  indexOffset: number
}

export interface CarV2Header extends CarV2FixedHeader {
  version: 2
  roots: CID[]
}

export interface CarDecoder {
  header: () => Promise<CarHeader|CarV2Header>

  blocks: () => AsyncGenerator<Block>

  blocksIndex: () => AsyncGenerator<BlockIndex>
}

export interface Seekable {
  seek: (length: number) => void
}

export interface BytesReader extends Seekable {
  upTo: (length: number) => Promise<Uint8Array>

  exactly: (length: number, seek?: boolean) => Promise<Uint8Array>

  pos: number
}

export interface BytesBufferReader extends Seekable{
  upTo: (length: number) => Uint8Array

  exactly: (length: number, seek?: boolean) => Uint8Array

  pos: number
}
