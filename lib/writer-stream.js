const CID = require('cids')
const Block = require('@ipld/block')
const { Writer } = require('./reader-writer-iface')
const { Encoder, createStreamWriter } = require('./coding')

class StreamWriter extends Writer {
  constructor (outStream) {
    super()
    this._outStream = outStream
    const writer = createStreamWriter(outStream)
    this._encoder = Encoder(writer)
    this._mutex = null
  }

  /* async */ setRoots (roots) {
    // istanbul ignore next toohard
    if (this._mutex) {
      throw new Error('Roots already set or blocks are being written')
    }
    super.setRoots(roots)
    this._mutex = (async () => {
      await this._encoder.setRoots(this.roots)
    })()
    return this._mutex
  }

  delete (key) {
    throw new Error('Unsupported operation for streaming writer')
  }

  async put (key, value) {
    if (!this._mutex) {
      // no roots, too late to set any now but we need to write the header
      this.setRoots([])
    }
    this._mutex = this._mutex.then(() => this._encoder.writeBlock(Block.create(value, new CID(key))))
    return this._mutex
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
