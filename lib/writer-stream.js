const CID = require('cids')
const Block = require('@ipld/block')
const { Writer } = require('./reader-writer-iface')
const { verifyRoots } = require('./util')
const { Encoder, createStreamWriter } = require('./coding')

class StreamWriter extends Writer {
  constructor (outStream) {
    super()
    this._outStream = outStream
    const writer = createStreamWriter(outStream)
    this._encoder = Encoder(writer)
    this._rootsSet = false
  }

  setRoots (roots) {
    if (this._rootsSet) {
      throw new Error('Roots already set or blocks are being written')
    }
    this._rootsSet = true
    roots = verifyRoots(roots)
    return this._encoder.setRoots(roots)
  }

  delete (key) {
    throw new Error('Unsupported operation for streaming writer')
  }

  async put (key, value) {
    if (!this._rootsSet) {
      // no roots, too late to set any now but we need to write the header
      this.setRoots([])
    }
    return this._encoder.writeBlock(Block.create(value, new CID(key)))
  }

  async close () {
    return new Promise((resolve, reject) => {
      this._outStream.once('error', reject)
      this._outStream.once('finish', resolve)
      this._outStream.end()
    })
  }
}

function create (stream) {
  return new StreamWriter(stream)
}

module.exports = create
