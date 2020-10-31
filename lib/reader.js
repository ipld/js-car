import fs from 'fs'
import { promisify } from 'util'
import { CarReader, fromBytes, fromIterable } from './reader-browser.js'

/**
 * @typedef {import('../api').Block} Block
 * @typedef {import('../api').BlockIndex} BlockIndex
 */

const fsread = promisify(fs.read)

/**
 * @param {fs.promises.FileHandle | number} fd
 * @param {BlockIndex} blockIndex
 * @returns {Promise<Block>}
 */
async function readRaw (fd, blockIndex) {
  const { cid, blockLength, blockOffset } = blockIndex
  const bytes = new Uint8Array(blockLength)
  let read
  if (typeof fd === 'number') {
    read = (await fsread(fd, bytes, 0, blockLength, blockOffset)).bytesRead
  } else if (typeof fd === 'object' && typeof fd.read === 'function') { // FileDescriptor
    read = (await fd.read(bytes, 0, blockLength, blockOffset)).bytesRead
  } else {
    throw new TypeError('Bad fd')
  }
  if (read !== blockLength) {
    throw new Error(`Failed to read entire block (${read} instead of ${blockLength})`)
  }
  return { cid, bytes }
}

class NodeCarReader extends CarReader {}
NodeCarReader.fromBytes = fromBytes
NodeCarReader.fromIterable = fromIterable
NodeCarReader.readRaw = readRaw

export { NodeCarReader as CarReader, fromBytes, fromIterable, readRaw }
export const __browser = false
