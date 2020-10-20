class StoreIterator {
  constructor (version, roots, iterable) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._iterable = iterable
    this._decoded = false
  }

  async getRoots () {
    return this._roots
  }

  async * blocks () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block
    }
  }

  async * cids () {
    if (this._decoded) {
      throw new Error('Cannot decode more than once')
    }
    this._decoded = true
    for await (const block of this._iterable) {
      yield block.cid
    }
  }
}

class StoreReader extends StoreIterator {
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

class StoreIndexer {
  constructor (version, roots, indexData) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
    this._indexData = indexData
  }

  async getRoots () {
    return this._roots
  }

  [Symbol.asyncIterator] () {
    const indexData = this._indexData.slice()
    return {
      async next () {
        if (!indexData.length) {
          return { done: true }
        }
        return { done: false, value: indexData.shift() }
      }
    }
  }
}

class CarWriter {
  constructor (roots, encoder, iterator) {
    this._encoder = encoder
    this._mutex = encoder.setRoots(roots)
    this._iterator = iterator
    this._ended = false
  }

  async put (block) {
    if (!(block.bytes instanceof Uint8Array) || !block.cid || block.cid.asCID !== block.cid) {
      throw new TypeError('Can only write Block objects')
    }
    this._mutex = this._mutex.then(() => this._encoder.writeBlock(block))
    return this._mutex
  }

  async close () {
    if (this._ended) {
      throw new Error('Already closed')
    }
    await this._mutex
    this._ended = true
    return this._encoder.close()
  }

  [Symbol.asyncIterator] () {
    if (this._iterating) {
      throw new Error('Multiple iterator not supported')
    }
    this._iterating = true
    return this._iterator
  }
}

export {
  StoreReader,
  StoreIndexer,
  StoreIterator,
  CarWriter
}
