import interfaceDatastore from 'interface-datastore'

const { Errors } = interfaceDatastore

class Reader {
  constructor (multiformats) {
    this.multiformats = multiformats
  }

  /* c8 ignore next 3 */
  get () {
    throw new Error('Unimplemented method')
  }

  /* c8 ignore next 3 */
  has () {
    throw new Error('Unimplemented method')
  }

  /* c8 ignore next 3 */
  keys () {
    throw new Error('Unimplemented method')
  }

  close () {}

  getRoots () {
    return this.roots
  }
}

class Writer {
  constructor (multiformats) {
    this.multiformats = multiformats
  }

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

  close () {}
}

class NoWriter extends Writer {
  setRoots () {
    throw new Error('Unimplemented method')
  }
}

class DecodedReader extends Reader {
  constructor (multiformats, carData) {
    super(multiformats)
    this._carData = carData
  }

  has (key) {
    return this._carData.keys.indexOf(key.toString()) > -1
  }

  async get (key) {
    const index = this._carData.keys.indexOf(key.toString())
    if (index < 0) {
      throw Errors.notFoundError()
    }
    return this._carData.blocks[index].binary
  }

  keys () {
    return this._carData.keys
  }

  get roots () {
    return this._carData.roots
  }
}

class StreamingReader extends Reader {
  constructor (multiformats, decoder) {
    super(multiformats)
    this._decoder = decoder
  }

  has (key) {
    throw new Error('Unsupported operation for streaming reader')
  }

  get (key) {
    throw new Error('Unsupported operation for streaming reader')
  }

  async getRoots () {
    return (await this._decoder.header()).roots
  }

  async * iterator (keysOnly) {
    // TODO: optimise `keysOnly` case by skipping over decoding blocks and just read the CIDs
    for await (const block of this._decoder.blocks()) {
      const key = block.cid.toString()
      if (keysOnly) {
        yield { key }
      } else {
        yield { key, value: block.binary }
      }
    }
  }
}

async function createFromDecoded (multiformats, decoded) {
  const cids = decoded.blocks.map((b) => b.cid)
  decoded.keys = cids.map((c) => c.toString())
  return new DecodedReader(multiformats, decoded)
}

export { createFromDecoded, Reader, Writer, StreamingReader, NoWriter }
