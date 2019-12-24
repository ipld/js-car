const { filter, map } = require('interface-datastore').utils
const { toKey } = require('./lib/util')

/**
 * CarDatastore is a class to manage reading from, and writing to a CAR archives
 * using [CID](https://github.com/multiformats/js-cid)s as keys and file names
 * in the CAR and binary block data as the file contents.
 *
 * @class
 */
class CarDatastore {
  constructor (reader, writer) {
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
   * @return {Buffer} the IPLD block data referenced by the CID.
   */
  async get (key) {
    key = toKey(key, 'get')
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
    key = toKey(key, 'has')
    return this._reader.has(key)
  }

  /**
   * @name CarDatastore#put
   * @description
   * Store a block in this archive. `key`s are converted to `CID` automatically,
   * whether you provide a native Datastore `Key` object, a `String` or a `CID`.
   * `key`s that cannot be converted will throw an error.
   *
   * Depending on the create-mode of this CarDatastore, the entry may not be
   * written to the CAR archive until `close()` is called and in the meantime be
   * stored in memory. If you need to write a lot of data, ensure you are using
   * a stream-writing create-mode.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the `value`.
   * @param {Buffer|Uint8Array} value an IPLD block matching the given `key`
   * `CID`.
   */
  async put (key, value) {
    key = toKey(key, 'put')
    if (!(value instanceof Uint8Array)) {
      throw new TypeError('put() can only receive Uint8Arrays or Buffers')
    }
    return this._writer.put(key, value)
  }

  /**
   * @name CarDatastore#delete
   * @description
   * Delete a block from this archive. `key`s are converted to `CID`
   * automatically, whether you provide a native Datastore `Key` object, a
   * `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * If the `key` does not exist, `delete()` will silently return.
   *
   * This operation may not be supported in some create-modes; a write-only mode
   * may throw an error if unsupported. Where supported, this mode is likely to
   * result in state stored in memory until the final `close()` is called.
   * @function
   * @async
   * @memberof CarDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify
   * the block.
   */
  async delete (key) {
    key = toKey(key, 'delete')
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
   * In some create-modes this operation may not be supported. In read-only
   * modes you cannot change the roots of a CarDatastore and an error may be
   * thrown.
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
   * If the create-mode of the current CarDatastore supports writes and a
   * mutation operation has been called on the open archive (`put()`,
   * `delete()`), a new CAR archive will be written with the mutated contents.
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

module.exports = CarDatastore
