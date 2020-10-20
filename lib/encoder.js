import varint from 'varint'
import * as dagCbor from '@ipld/dag-cbor'
import { CarWriter } from './storage.js'

function createEncoder (writeCb, closeCb) {
  // none of this is wrapped in a mutex, that needs to happen above this to
  // avoid overwrites

  return {
    // assumes array of proper CID objects
    async setRoots (roots) {
      const header = dagCbor.encode({ version: 1, roots })
      await writeCb(new Uint8Array(varint.encode(header.length)))
      await writeCb(header)
    },

    // assumes a proper Block object
    async writeBlock (block) {
      const { cid, bytes } = block
      await writeCb(new Uint8Array(varint.encode(cid.bytes.length + bytes.length)))
      await writeCb(cid.bytes)
      await writeCb(bytes)
    },

    close () {
      return closeCb()
    }
  }
}

function encodeWriter (roots) {
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

  return new CarWriter(roots, encoder, iterator)
}

export { encodeWriter }
