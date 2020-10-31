import CID from 'multiformats/cid'
import { createEncoder } from './encoder.js'

/**
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockWriter} BlockWriter
 * @typedef {import('../api').WriterChannel} WriterChannel
 * @typedef {import('./coding').CarEncoder} CarEncoder
 */

/**
 * @class
 * @implements {BlockWriter}
 */
class CarWriter {
  /**
   * @param {CID[]} roots
   * @param {CarEncoder} encoder
   */
  constructor (roots, encoder) {
    this._encoder = encoder
    this._mutex = encoder.setRoots(roots)
    this._ended = false
  }

  /**
   * @param {Block} block
   * @returns {Promise<void>}
   */
  async put (block) {
    if (!(block.bytes instanceof Uint8Array) || !block.cid) {
      throw new TypeError('Can only write {cid, binary} objects')
    }
    const cid = CID.asCID(block.cid)
    if (!cid) {
      throw new TypeError('Can only write {cid, binary} objects')
    }
    this._mutex = this._mutex.then(() => this._encoder.writeBlock({ cid, bytes: block.bytes }))
    return this._mutex
  }

  /**
   * @returns {Promise<void>}
   */
  async close () {
    if (this._ended) {
      throw new Error('Already closed')
    }
    await this._mutex
    this._ended = true
    return this._encoder.close()
  }
}

/**
 * @class
 * @implements {AsyncIterable<Uint8Array>}
 */
class CarWriterOut {
  /**
   * @param {AsyncIterator<Uint8Array>} iterator
   */
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
  /** @type {Uint8Array[]} */
  const queue = []
  /** @type {function | null} */
  let resolver = null
  /** @type {Promise<void> | null} */
  let drainer = null
  /** @type {function | null} */
  let drainerResolver = null
  let ended = false
  // let iterating = false

  /** @type {AsyncIterator<Uint8Array>} */
  const iterator = {
    async next () {
      const value = queue.shift()
      if (value) {
        return { done: false, value }
      } else {
        if (drainer && drainerResolver) {
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
        return { done: true, value: undefined }
      }

      return new Promise((resolve) => {
        resolver = () => {
          const value = queue.shift()
          if (value) {
            if (!queue.length) { // last one
              if (drainer && drainerResolver) {
                drainerResolver()
                drainerResolver = null
                drainer = null
              }
            }
            return resolve({ done: false, value })
          }

          if (ended) {
            return resolve({ done: true, value: undefined })
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
  }, async () => {
    ended = true
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  return { encoder, iterator }
}

/**
 * @param {CID[] | CID | void} roots
 * @returns {CID[]}
 */
function toRoots (roots) {
  if (roots === undefined) {
    return []
  }

  if (!Array.isArray(roots)) {
    const cid = CID.asCID(roots)
    if (!cid) {
      throw new TypeError('roots must be a single CID or an array of CIDs')
    }
    return [cid]
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

/**
 * @param {CID[] | CID | void} roots
 * @returns {WriterChannel}
 */
function create (roots) {
  roots = toRoots(roots)
  const { encoder, iterator } = encodeWriter()
  const writer = new CarWriter(roots, encoder)
  const out = new CarWriterOut(iterator)
  return { writer, out }
}

CarWriter.create = create

export { CarWriter, CarWriterOut, create }
