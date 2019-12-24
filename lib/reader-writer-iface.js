const { Errors } = require('interface-datastore')
const { verifyRoots, cidToKey } = require('./util')
const deletedSymbol = Symbol.for('deleted entry')

class Reader {
  // istanbul ignore next
  get () {
    throw new Error('Unimplemented method')
  }

  // istanbul ignore next
  has () {
    throw new Error('Unimplemented method')
  }

  // istanbul ignore next
  keys () {
    throw new Error('Unimplemented method')
  }

  close () {}

  getRoots () {
    return this.roots
  }
}

class Writer {
  put () {
    throw new Error('Unimplemented method')
  }

  delete () {
    throw new Error('Unimplemented method')
  }

  setRoots (roots) {
    this.roots = verifyRoots(roots)
  }

  close () {}
}

class EmptyReader extends Reader {
  async get () {
    throw Errors.notFoundError()
  }

  has () {
    return false
  }

  keys () {
    return []
  }
}

class NoWriter extends Writer {
  setRoots () {
    throw new Error('Unimplemented method')
  }
}

class CachingReader extends Reader {
  constructor (reader) {
    super()
    this._reader = reader
    this.cache = new Map()
  }

  get roots () {
    return this._reader.roots
  }

  set roots (roots) {
    this._reader.roots = roots
  }

  async get (key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)
      if (value === deletedSymbol) {
        throw Errors.notFoundError()
      }
      return value
    }
    const value = this._reader.get(key)
    return value.then((v) => {
      this.cache.set(key, v)
      return v
    })
  }

  keys () { // this doesn't have to include cache keys
    return this._reader.keys()
  }

  has (key) {
    if (this.cache.has(key)) {
      return this.cache.get(key) !== deletedSymbol
    }
    return this._reader.has(key)
  }

  getRoots () {
    return Reader.prototype.getRoots.apply(this)
  }

  close () {
    return this._reader.close()
  }
}

class CachingDeferredWriter extends Writer {
  constructor (cachingReader, createWriter) {
    super()
    this.cachingReader = cachingReader
    this.createWriter = createWriter
    // we need to control the reader close operation, if it's closed
    // prematurely then we can't read the existing entries before writing
    this._cachingReaderClose = cachingReader.close
    cachingReader.close = () => {}
  }

  /* we only set roots on writer and read from reader
  get roots () {
    return this.cachingReader.roots
  }
  */

  set roots (roots) {
    this.cachingReader.roots = roots
  }

  put (key, value) {
    this.cachingReader.cache.set(key, value)
  }

  delete (key) {
    this.cachingReader.cache.set(key, deletedSymbol)
  }

  async close () {
    await Promise.all(this.cachingReader.keys().map((key) => {
      if (!this.cachingReader.cache.has(key)) {
        return this.cachingReader.get(key) // cache the value
      }
    }))

    await this._cachingReaderClose.call(this.cachingReader)
    const writer = await this.createWriter()

    for (const [key, value] of this.cachingReader.cache.entries()) {
      if (value && value !== deletedSymbol) {
        await writer.put(key, value)
      }
    }

    writer.roots = this.cachingReader.roots

    return writer.close()
  }
}

class DecodedReader extends Reader {
  constructor (carData) {
    super()
    this._carData = carData
  }

  has (key) {
    return this._carData.keys.indexOf(key) > -1
  }

  async get (key) {
    const index = this._carData.keys.indexOf(key)
    if (index < 0) {
      throw Errors.notFoundError()
    }
    return this._carData.blocks[index].encode()
  }

  keys () {
    return this._carData.keys
  }

  get roots () {
    return this._carData.roots
  }
}

class StreamingReader extends Reader {
  constructor (decoder) {
    super()
    this._decoder = decoder
  }

  has (key) {
    throw new Error('Unsupported operation for streaming reader')
  }

  get (key) {
    throw new Error('Unsupported operation for streaming reader')
  }

  keys () {
    throw new Error('Unsupported operation for streaming reader')
  }

  async getRoots () {
    return (await this._decoder.header()).roots
  }

  async * iterator (keysOnly) {
    // TODO: optimise `keysOnly` case by skipping over decoding blocks and just read the CIDs
    for await (const block of this._decoder.blocks()) {
      const key = cidToKey(await block.cid())
      if (keysOnly) {
        yield { key }
      } else {
        const value = block.encode()
        yield { key, value }
      }
    }
  }
}

async function createFromDecoded (decoded) {
  const cids = await Promise.all(decoded.blocks.map((b) => b.cid()))
  decoded.keys = cids.map((c) => c.toString())
  return new DecodedReader(decoded)
}

module.exports.createFromDecoded = createFromDecoded

module.exports.Reader = Reader
module.exports.Writer = Writer
module.exports.EmptyReader = EmptyReader
module.exports.StreamingReader = StreamingReader
module.exports.NoWriter = NoWriter
module.exports.CachingReader = CachingReader
module.exports.CachingDeferredWriter = CachingDeferredWriter
