import interfaceDatastore from 'interface-datastore'
import { toKey } from './lib/util.js'

const { filter, map } = interfaceDatastore.utils

/**
 * CarDatastore is a class to manage reading from, and writing to a CAR archives
 * using [CID](https://github.com/multiformats/js-multiformats)s as keys and
 * file names in the CAR and binary block data as the file contents.
 *
 * @class
 */
class CarDatastore {
  constructor (multiformats, reader, writer) {
    this._multiformats = multiformats
    this._reader = reader
    this._writer = writer
  }

  /**
   * @name CarDatastore#get
   * @description
   * Retrieve a block from this archive. `key`s are converted to `CID`
   * automatically, whether you provide a native Datastore `Key` object, a
   * `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * This operation may not be supported in some create-modes; a write-only mode
   * may throw an error if unsupported.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the block.
   * @return {Uint8Array} the IPLD block data referenced by the CID.
   */
  async get (key) {
    key = toKey(this._multiformats, key, 'get')
    return this._reader.get(key)
  }

  /**
   * @name CarDatastore#has
   * @description
   * Check whether a block exists in this archive. `key`s are converted to `CID`
   * automatically, whether you provide a native Datastore `Key` object, a
   * `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * This operation may not be supported in some create-modes; a write-only mode
   * may throw an error if unsupported.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the block.
   * @return {boolean} indicating whether the key exists in this Datastore.
   */
  async has (key) {
    key = toKey(this._multiformats, key, 'has')
    return this._reader.has(key)
  }

  /**
   * @name CarDatastore#put
   * @description
   * Store a block in this archive. `key`s are converted to `CID` automatically,
   * whether you provide a native Datastore `Key` object, a `String` or a `CID`.
   * `key`s that cannot be converted will throw an error.
   *
   * Only supported by the `CarDatastore.writeStream()` create-mode.
   * CarDatastores constructed by other create-modes will not support `put()`
   * and an Error will be thrown when it is called.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the `value`.
   * @param {Uint8Array} value an IPLD block matching the given `key`
   * `CID`.
   */
  async put (key, value) {
    key = toKey(this._multiformats, key, 'put')
    if (!(value instanceof Uint8Array)) {
      throw new TypeError('put() can only receive Uint8Arrays or Buffers')
    }
    return this._writer.put(key, value)
  }

  /**
   * @name CarDatastore#delete
   * @description
   * **Currently not supported by any create-mode**. CarDatastore is currently
   * an append-only and read-only construct.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the block.
   */
  async delete (key) {
    key = toKey(this._multiformats, key, 'delete')
    return this._writer.delete(key)
  }

  /**
   * @name CarDatastore#setRoots
   * @description
   * Set the list of roots in the CarDatastore archive on this CAR archive.
   *
   * The roots will be written to the comment section of the CAR archive when
   * `close()` is called, in the meantime it is stored in memory.
   *
   * Only supported by the `CarDatastore.writeStream()` create-mode.
   * CarDatastores constructed by other create-modes will not support `put()`
   * and an Error will be thrown when it is called.
   * @function
   * @async
   * @param {string} comment an arbitrary comment to store in the CAR archive.
   */
  async setRoots (roots) {
    return this._writer.setRoots(roots)
  }

  /**
   * @name CarDatastore#getRoots
   * @description
   * Get the list of roots set on this CAR archive if they exist exists. See
   * {@link CarDatastore#setRoots}.
   * @function
   * @async
   * @return {Array<CID>} an array of CIDs
   */
  async getRoots () {
    return this._reader.getRoots()
  }

  /**
   * @name CarDatastore#close
   * @description
   * Close this archive, free resources and write its new contents if required
   * and supported by the create-mode used.
   *
   * This may or may not have any effect on the use of the underlying resource
   * depending on the create-mode of the CarDatastore.
   * @function
   * @async
   */
  async close () {
    if (this._closed) {
      throw new Error('close() already called')
    }
    this._closed = true
    return Promise.all([this._reader.close(), this._writer.close()])
  }

  async batch () {
    /* c8 ignore next */
    throw new Error('Unimplemented operation')
  }

  /**
   * @name CarDatastore#query
   * @description
   * Create an async iterator for the entries of this CarDatastore. Ideally for
   * use with `for await ... of` to lazily iterate over the entries.
   *
   * By default, each element returned by the iterator will be an object with a
   * `key` property with the string CID of the entry and a `value` property with
   * the binary data.
   *
   * Supply `{ keysOnly: true }` as an argument and the elements will only
   * contain the keys, without needing to load the values from storage.
   *
   * The `filters` parameter is also supported as per the Datastore interface.
   *
   * This operation may not be supported in some create-modes; a write-only mode
   * may throw an error if unsupported.
   * @function
   * @async
   * @generator
   * @param {Object} [q] query parameters
   * @return {AsyncIterator<key,value>}
   * @yields {Object<key,value>}
   */
  query (q) {
    if (q === undefined) {
      q = {}
    }

    if (typeof q !== 'object') {
      throw new TypeError('query argument must be an object, supply `{}` to match all')
    }

    let it

    if (typeof this._reader.iterator === 'function') {
      it = this._reader.iterator(q.keysOnly)
    } else {
      const keys = this._reader.keys()
      if (!q.keysOnly) {
        const mapper = async (key) => ({ key, value: await this.get(key) })
        it = map(keys, mapper)
      } else {
        it = map(keys, (key) => ({ key }))
      }
    }

    if (Array.isArray(q.filters)) {
      it = q.filters.reduce((it, key) => filter(it, key), it)
    }

    /* not supported
    if (Array.isArray(q.orders)) {
      it = q.orders.reduce((it, key) => sortAll(it, key), it)
    }

    if (q.offset != null) {
      let i = 0
      it = filter(it, () => i++ >= q.offset)
    }

    if (q.limit != null) {
      it = take(it, q.limit)
    }
    */

    return it
  }
}

export default CarDatastore
