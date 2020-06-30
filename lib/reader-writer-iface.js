const { Errors } = require('interface-datastore')
const { verifyRoots, cidToKey } = require('./util')

class Reader {
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

class NoWriter extends Writer {
  setRoots () {
    throw new Error('Unimplemented method')
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
module.exports.StreamingReader = StreamingReader
module.exports.NoWriter = NoWriter
