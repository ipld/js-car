import {
  asyncIterableReader,
  bytesReader,
  createDecoder
} from './decoder.js'
import { CarIterator } from './iterator.js'

class CarReader extends CarIterator {
  constructor (version, roots, blocks) {
    super(version, roots)
    this._blocks = blocks
    this._keys = blocks.map((b) => b.cid.toString())
  }

  async has (key) {
    return this._keys.indexOf(key.toString()) > -1
  }

  async get (key) {
    const index = this._keys.indexOf(key.toString())
    return index > -1 ? this._blocks[index] : undefined
  }

  async * blocks () {
    for (const block of this._blocks) {
      yield block
    }
  }

  async * cids () {
    for (const block of this._blocks) {
      yield block.cid
    }
  }
}

async function decodeReaderComplete (reader) {
  const decoder = createDecoder(reader)
  const { version, roots } = await decoder.header()
  const blocks = []
  for await (const block of decoder.blocks()) {
    blocks.push(block)
  }

  return new CarReader(version, roots, blocks)
}

async function fromBytes (bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('fromBytes() requires a Uint8Array')
  }
  return decodeReaderComplete(bytesReader(bytes))
}

async function fromIterable (asyncIterable) {
  if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
    throw new TypeError('fromIterable() requires an async iterable')
  }
  return decodeReaderComplete(asyncIterableReader(asyncIterable))
}

CarReader.fromBytes = fromBytes
CarReader.fromIterable = fromIterable

export { CarReader, fromBytes, fromIterable }
export const __browser = true
