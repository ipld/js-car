import * as coding from './coding-browser.js'
import { createFromDecoded } from './reader-writer-iface.js'

async function createBufferReader (multiformats, data) {
  const decoded = await coding.decodeBuffer(multiformats, data)
  return createFromDecoded(decoded)
}

export { createBufferReader }
