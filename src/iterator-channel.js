/**
 * @template {any} T
 * @typedef {import('./coding.js').IteratorChannel<T>} IteratorChannel
 */

function noop () {}

/**
 * @template {any} T
 * @returns {IteratorChannel<T>}
 */
export function create () {
  /** @type {T[]} */
  const chunkQueue = []
  /** @type {Promise<void> | null} */
  let drainer = null
  let drainerResolver = noop
  let ended = false
  /** @type {Error | null} */
  let errored = null
  let hasErrored = false
  /** @type {Promise<IteratorResult<T>> | null} */
  let outWait = null
  let outWaitResolver = noop

  const makeDrainer = () => {
    if (!drainer) {
      drainer = new Promise((resolve) => {
        drainerResolver = () => {
          drainer = null
          drainerResolver = noop
          resolve()
        }
      })
    }
    return drainer
  }

  /**
   * @returns {IteratorChannel<T>}
   */
  const writer = {
    /**
     * @param {T} chunk
     * @returns {Promise<void>}
     */
    write (chunk) {
      chunkQueue.push(chunk)
      const drainer = makeDrainer()
      outWaitResolver()
      return drainer
    },

    async end () {
      ended = true
      const drainer = makeDrainer()
      outWaitResolver()
      await drainer
    },

    /**
     * Fail the channel: a consumer of the iterator receives `err` after any
     * already-queued chunks, instead of the stream hanging open.
     *
     * @param {Error} err
     */
    error (err) {
      if (!hasErrored) {
        hasErrored = true
        errored = err
      }
      drainerResolver()
      outWaitResolver()
    }
  }

  /** @type {AsyncIterator<T>} */
  const iterator = {
    /** @returns {Promise<IteratorResult<T>>} */
    async next () {
      const chunk = chunkQueue.shift()
      if (chunk) {
        if (chunkQueue.length === 0) {
          drainerResolver()
        }
        return { done: false, value: chunk }
      }

      if (hasErrored) {
        throw errored
      }

      if (ended) {
        drainerResolver()
        return { done: true, value: undefined }
      }

      if (!outWait) {
        outWait = new Promise((resolve) => {
          outWaitResolver = () => {
            outWait = null
            outWaitResolver = noop
            return resolve(iterator.next())
          }
        })
      }

      return outWait
    }
  }

  return { writer, iterator }
}
