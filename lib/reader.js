const fs = require('fs').promises
const { Errors } = require('interface-datastore')
const coding = require('./coding')
const { createFromDecoded, StreamingReader, Reader } = require('./reader-writer-iface')
const { indexer, readRaw } = require('./raw')

async function createStreamCompleteReader (multiformats, stream) {
  const decoded = await coding.decodeStream(multiformats, stream)
  return createFromDecoded(decoded)
}

async function createStreamingReader (multiformats, stream) {
  const decoder = coding.StreamDecoder(multiformats, stream)
  return new StreamingReader(decoder)
}

async function createFileReader (multiformats, data) {
  const decoded = await coding.decodeFile(multiformats, data)
  return createFromDecoded(decoded)
}

async function createFileIndexedReader (multiformats, path) {
  const { roots, iterator } = await indexer(multiformats, path)
  const index = new Map()
  const order = []
  for await (const blockIndex of iterator) {
    const cidStr = blockIndex.cid.toString()
    index.set(cidStr, blockIndex)
    order.push(cidStr)
  }
  return new IndexedReader(path, roots, index, order)
}

class IndexedReader extends Reader {
  constructor (path, roots, index, order) {
    super()
    this._path = path
    this._roots = roots
    this._index = index
    this._order = order
    this._fd = null
  }

  has (key) {
    return this._index.has(key.toString())
  }

  async get (key) {
    const blockIndex = this._index.get(key.toString())
    if (!blockIndex) {
      throw Errors.notFoundError()
    }
    if (!this._fd) {
      this._fd = await fs.open(this._path)
    }
    return (await readRaw(this._fd, blockIndex)).binary
  }

  async * iterator (keysOnly) {
    if (keysOnly) {
      for (const key of this._order) {
        yield { key }
      }
    } else {
      if (!this._fd) {
        this._fd = await fs.open(this._path)
      }
      for (const cidStr of this._order) {
        const blockIndex = this._index.get(cidStr)
        const { binary } = await readRaw(this._fd, blockIndex)
        yield { key: cidStr, value: binary }
      }
    }
  }

  get roots () {
    return this._roots
  }

  async close () {
    if (this._fd) {
      return this._fd.close()
    }
  }
}

module.exports.createStreamCompleteReader = createStreamCompleteReader
module.exports.createStreamingReader = createStreamingReader
module.exports.createFileReader = createFileReader
module.exports.createFileIndexedReader = createFileIndexedReader
