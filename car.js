import {
  decodeComplete,
  indexerComplete,
  asyncIterableReader,
  bytesReader
} from './lib/decoder.js'
import { Encoder } from './lib/encoder.js'

function CarReader (Block) {
  return {
    async fromBytes (bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('fromBytes() requires a Uint8Array')
      }
      return decodeComplete(Block, bytesReader(bytes))
    },

    async fromIterable (asyncIterable) {
      if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
        throw new TypeError('fromIterable() requires an async iterable')
      }
      return decodeComplete(Block, asyncIterableReader(asyncIterable))
    }
  }
}

function CarIndexer (Block) {
  return {
    async fromBytes (bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('fromBytes() requires a Uint8Array')
      }
      return indexerComplete(Block, bytesReader(bytes))
    },

    async fromIterable (asyncIterable) {
      if (!asyncIterable || !(typeof asyncIterable[Symbol.asyncIterator] === 'function')) {
        throw new TypeError('fromIterable() requires an async iterable')
      }
      return indexerComplete(Block, asyncIterableReader(asyncIterable))
    }
  }
}

function CarWriter (Block) {
  const { CID } = Block.multiformats
  const queue = []
  let resolver = null
  let drainer = null
  let drainerResolver = null
  let ended = false
  let iterating = false

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

  const encoder = Encoder(Block, (chunk) => {
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
  })

  let mutex = Promise.resolve()

  class CarWriter {
    constructor (roots) {
      mutex = encoder.setRoots(toRoots(roots))
    }

    async put (block) {
      if (typeof block.encode !== 'function' || typeof block.cid !== 'function') {
        throw new TypeError('Can only write Block objects')
      }
      mutex = mutex.then(() => encoder.writeBlock(block))
      return mutex
    }

    async close () {
      if (ended) {
        throw new Error('Already closed')
      }
      await mutex
      ended = true
      if (resolver) {
        resolver()
        resolver = null
      }
    }

    [Symbol.asyncIterator] () {
      if (iterating) {
        throw new Error('Multiple iterator not supported')
      }
      iterating = true
      return iterator
    }
  }

  return {
    create (roots) {
      return new CarWriter(roots)
    }
  }
}

export {
  CarReader,
  CarIndexer,
  CarWriter
}
