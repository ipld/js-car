import { CID } from 'multiformats'
import { createEncoder } from './encoder.js'

class CarWriter {
  constructor (roots, encoder) {
    this._encoder = encoder
    this._mutex = encoder.setRoots(roots)
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
}

class CarWriterOut {
  constructor (iterator) {
    this._iterator = iterator
  }

  [Symbol.asyncIterator] () {
    if (this._iterating) {
      throw new Error('Multiple iterator not supported')
    }
    this._iterating = true
    return this._iterator
  }
}

function encodeWriter () {
  const queue = []
  let resolver = null
  let drainer = null
  let drainerResolver = null
  let ended = false
  // let iterating = false

  const iterator = {
    async next () {
      if (queue.length) {
        return { done: false, value: queue.shift() }
      } else {
        if (drainer) {
          drainerResolver()
          drainerResolver = null
          drainer = null
        }
      }

      // This is a special case that shouldn't be possible with the mutex and
      // drainer queue. Writes are blocked in deferred Promises until data is
      // consumed.
      /* c8 ignore next 3 */
      if (ended) {
        return { done: true }
      }

      return new Promise((resolve) => {
        resolver = () => {
          if (queue.length) {
            if (queue.length === 1) {
              if (drainer) {
                drainerResolver()
                drainerResolver = null
                drainer = null
              }
            }
            return resolve({ done: false, value: queue.shift() })
          }

          if (ended) {
            return resolve({ done: true })
          /* c8 ignore next 5 */
          } else {
            // recurse until we find something; but this might not be a
            // possible path with the mutex in place
            return resolve(iterator.next())
          }
        }
      })
    }
  }

  const encoder = createEncoder((chunk) => {
    queue.push(chunk)
    if (!drainer) {
      drainer = new Promise((resolve) => {
        drainerResolver = resolve
      })
    }
    if (resolver) {
      resolver()
      resolver = null
    }
    return drainer
  }, () => {
    ended = true
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  return { encoder, iterator }
}

function toRoots (roots) {
  if (roots && roots.asCID === roots) {
    roots = [roots]
  }
  if (roots === undefined) {
    roots = []
  }
  if (!Array.isArray(roots)) {
    throw new TypeError('roots must be a single CID or an array of CIDs')
  }
  const _roots = []
  for (const root of roots) {
    const _root = CID.asCID(root)
    if (!_root) {
      throw new TypeError('roots must be a single CID or an array of CIDs')
    }
    _roots.push(_root)
  }
  return _roots
}

function create (roots) {
  roots = toRoots(roots)
  const { encoder, iterator } = encodeWriter()
  const writer = new CarWriter(roots, encoder)
  const out = new CarWriterOut(iterator)
  return { writer, out }
}

CarWriter.create = create

export { CarWriter, CarWriterOut, create }
