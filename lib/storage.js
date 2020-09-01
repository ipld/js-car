class Store {
  constructor (multiformats) {
    this.multiformats = multiformats
  }

  close () {}
}

class StoreReader extends Store {
  /* c8 ignore next 3 */
  get () {
    throw new Error('Unimplemented method')
  }

  /* c8 ignore next 3 */
  has () {
    throw new Error('Unimplemented method')
  }

  getRoots () {
    return this.roots
  }
}

class StoreIterator extends Store {
  /* c8 ignore next 3 */
  cids () {
    throw new Error('Unimplemented method')
  }

  /* c8 ignore next 3 */
  blocks () {
    throw new Error('Unimplemented method')
  }
}

class StoreWriter extends Store {
  /* c8 ignore next 3 */
  put () {
    throw new Error('Unimplemented method')
  }

  /* c8 ignore next 3 */
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

export {
  StoreReader,
  StoreIterator,
  StoreWriter,
  DecodedReader,
  StreamingIterator
}
