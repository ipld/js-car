import fs from 'fs'
import { Readable } from 'stream'
import CID from 'multiformats/cid'
import CarIndexer from './indexer.js'
import NodeCarReader from './reader.js'

/**
 * @typedef {import('fs').promises.FileHandle} FileHandle
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockIndex} BlockIndex
 * @typedef {import('../api').RootsReader} RootsReader
 * @typedef {import('../api').BlockReader} BlockReader
 * @typedef {{ blockLength:number, blockOffset:number }} RawLocation
 */

/**
 * @class
 * @implements {RootsReader}
 * @implements {BlockReader}
 */
export default class NodeIndexedCarReader {
  /**
   * @param {number} version
   * @param {string} path
   * @param {CID[]} roots
   * @param {Map<string, RawLocation>} index
   * @param {string[]} order
   */
  constructor (version, path, roots, index, order) {
    this._version = version
    this._path = path
    this._roots = roots
    this._index = index
    this._order = order
    this._fd = null
  }

  get version () {
    return this._version
  }

  /**
   * @returns {Promise<CID[]>}
   */
  async getRoots () {
    return this._roots
  }

  /**
   * @param {CID} key
   * @returns {Promise<boolean>}
   */
  async has (key) {
    return this._index.has(key.toString())
  }

  /**
   * @param {CID} key
   * @returns {Promise<Block | undefined>}
   */
  async get (key) {
    const blockIndex = this._index.get(key.toString())
    if (!blockIndex) {
      return undefined
    }
    if (!this._fd) {
      this._fd = await fs.promises.open(this._path, 'r')
    }
    const readIndex = {
      cid: key,
      length: 0,
      offset: 0,
      blockLength: blockIndex.blockLength,
      blockOffset: blockIndex.blockOffset
    }
    return NodeCarReader.readRaw(this._fd, readIndex)
  }

  /**
   * @returns {AsyncGenerator<Block>}
   */
  async * blocks () {
    for (const cidStr of this._order) {
      const block = await this.get(CID.parse(cidStr))
      /* c8 ignore next 3 */
      if (!block) {
        throw new Error('Unexpected internal error')
      }
      yield block
    }
  }

  /**
   * @returns {AsyncGenerator<CID>}
   */
  async * cids () {
    for (const cidStr of this._order) {
      yield CID.parse(cidStr)
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async close () {
    if (this._fd) {
      return this._fd.close()
    }
  }

  /**
   * @param {string} path
   * @returns {Promise<NodeIndexedCarReader>}
   */
  static async fromFile (path) {
    if (typeof path !== 'string') {
      throw new TypeError('fromFile() requires a file path string')
    }

    const iterable = await CarIndexer.fromIterable(Readable.from(fs.createReadStream(path)))
    /** @type {Map<string, RawLocation>} */
    const index = new Map()
    /** @type {string[]} */
    const order = []
    for await (const { cid, blockLength, blockOffset } of iterable) {
      const cidStr = cid.toString()
      index.set(cidStr, { blockLength, blockOffset })
      order.push(cidStr)
    }
    return new NodeIndexedCarReader(iterable.version, path, await iterable.getRoots(), index, order)
  }
}

export const __browser = false
