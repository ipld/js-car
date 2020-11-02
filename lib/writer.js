import CID from 'multiformats/cid'
import { createEncoder } from './encoder.js'
import iteratorChannel from './iterator-channel.js'

/**
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockWriter} BlockWriter
 * @typedef {import('../api').WriterChannel} WriterChannel
 * @typedef {import('./coding').CarEncoder} CarEncoder
 * @typedef {import('./coding').IteratorChannel<Uint8Array>} IteratorChannel
 */

/**
 * @class
 * @implements {BlockWriter}
 */
export default class CarWriter {
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

  /**
   * @param {CID[] | CID | void} roots
   * @returns {WriterChannel}
   */
  static create (roots) {
    roots = toRoots(roots)
    const { encoder, iterator } = encodeWriter()
    const writer = new CarWriter(roots, encoder)
    const out = new CarWriterOut(iterator)
    return { writer, out }
  }
}

/**
 * @class
 * @implements {AsyncIterable<Uint8Array>}
 */
export class CarWriterOut {
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
  /** @type {IteratorChannel} */
  const iw = iteratorChannel()
  const { writer, iterator } = iw
  const encoder = createEncoder(writer)
  return { encoder, iterator }
}

/**
 * @private
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
