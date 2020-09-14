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
      yield await block.cid()
    }
  }
}

class StoreReader extends StoreIterator {
  constructor (version, roots, blocks) {
    super(version, roots)
    this._blocks = blocks
    this._keys = Promise.all(blocks.map(async (b) => (await b.cid()).toString()))
    this._keysResolved = null
  }

  async has (key) {
    const keys = this._keysResolved || (this._keysResolved = await this._keys)
    return keys.indexOf(key.toString()) > -1
  }

  async get (key) {
    const keys = this._keysResolved || (this._keysResolved = await this._keys)
    const index = keys.indexOf(key.toString())
    return index > -1 ? this._blocks[index] : undefined
  }

  async * blocks () {
    for (const block of this._blocks) {
      yield block
    }
  }

  async * cids () {
    for (const block of this._blocks) {
      yield await block.cid()
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

export {
  StoreReader,
  StoreIndexer,
  StoreIterator
}
