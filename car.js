import {
  decodeComplete,
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

function CarWriter (Block) {
  const { CID } = Block.multiformats
  const queue = []
  let resolver = null
  let ended = false

  const iterator = {
    async next () {
      if (queue.length) {
        return { done: false, value: queue.shift() }
      }

      if (ended) {
        return { done: true }
      }

      return new Promise((resolve) => {
        resolver = () => {
          if (queue.length) {
            resolve({ done: false, value: queue.shift() })
          }

          if (ended) {
            return resolve({ done: true })
          } else {
            return resolve(iterator.next()) // recurse until we find something?
          }
        }
      })
    }
  }

  // TODO: cb should be async here, should have back-pressure
  const encoder = Encoder(Block, (chunk) => {
    queue.push(chunk)
    if (resolver) {
      resolver()
      resolver = null
    }
  })

  let mutex = Promise.resolve()

  class CarWriter {
    constructor (roots) {
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
      mutex = encoder.setRoots(_roots)
    }

    async put (block) {
      mutex = mutex.then(() => encoder.writeBlock(block))
      return mutex
    }

    async close () {
      await mutex
      // TODO: can only call this once
      ended = true
      if (resolver) {
        resolver()
        resolver = null
      }
    }

    [Symbol.asyncIterator] () {
      // TODO: single call allowed to this method
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
  CarWriter
}
