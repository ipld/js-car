import { Writer } from './reader-writer-iface.js'
import { Encoder, createStreamWriter } from './coding.js'

class StreamWriter extends Writer {
  constructor (multiformats, outStream) {
    super()
    this._outStream = outStream
    const writer = createStreamWriter(outStream)
    this._encoder = Encoder(multiformats, writer)
    this._mutex = null
  }

  /* async */ setRoots (roots) {
    /* c8 ignore next 3 */
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
    this._mutex = this._mutex.then(() => this._encoder.writeBlock({ cid: key, binary: value }))
    return this._mutex
  }

  async close () {
    this._mutex = (this._mutex ? this._mutex : Promise.resolve()).then(() => {
      return new Promise((resolve, reject) => {
        this._outStream.once('error', reject)
        this._outStream.once('finish', resolve)
        this._outStream.end()
      })
    })
    return this._mutex
  }
}

function create (multiformats, stream) {
  return new StreamWriter(multiformats, stream)
}

export default create
