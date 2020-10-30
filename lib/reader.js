import fs from 'fs'
import { promisify } from 'util'
import { CarReader, fromBytes, fromIterable } from './reader-browser.js'

const fsread = promisify(fs.read)

async function readRaw (fd, blockIndex) {
  /* c8 ignore next 3 */
  if (process.browser) {
    throw new Error('readRaw() not supported in a browser environment')
  }
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

CarReader.readRaw = readRaw

export { CarReader, fromBytes, fromIterable, readRaw }
export const __browser = false
