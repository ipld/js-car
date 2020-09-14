class StoreReader {
  constructor (version, roots, blocks) {
    Object.defineProperty(this, version, { writable: false, enumerable: true })
    this._roots = roots
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

  async getRoots () {
    return this._roots
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

/*
class StoreIterator {
  cids () {
    throw new Error('Unimplemented method')
  }

  blocks () {
    throw new Error('Unimplemented method')
  }
}

class StoreWriter {
  put () {
    throw new Error('Unimplemented method')
  }

  delete () {
    throw new Error('Unimplemented method')
  }

  setRoots (roots) {
    for (let i = 0; i < roots.length; i++) {
      roots[i] = this.multiformats.CID.asCID(roots[i])
      if (!roots[i]) {
        throw new TypeError('Roots must be CIDs') // or gently coercable to CIDs
      }
    }
    this.roots = roots
  }
}

class DecodedReader extends StoreReader {
  constructor (multiformats, decoded) {
    super(multiformats)

    this._blocks = decoded.blocks
    this._keys = decoded.blocks.map((b) => b.cid.toString())
  }

  has (key) {
    return this._carData.keys.indexOf(key.toString()) > -1
  }

  async get (key) {
    const index = this._carData.keys.indexOf(key.toString())
    if (index < 0) {
      return // undefined
    }
    return this._carData.blocks[index].binary
  }

  async getRoots () {
    return this._carData.roots
  }
}

class StreamingIterator extends StoreIterator {
  constructor (multiformats, decoder) {
    super(multiformats)
    this._decoder = decoder
  }

  async getRoots () {
    return (await this._decoder.header()).roots
  }

  async * blocks () {
    yield * this._decoder.blocks()
  }

  async * cids () {
    for await (const block of this._decoder.blocks()) {
      yield block.cid
    }
  }
}
*/

export {
  StoreReader,
  StoreIndexer
  /*
  StoreIterator,
  StoreWriter,
  DecodedReader,
  StreamingIterator
  */
}
