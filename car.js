import { decodeComplete, bytesReader } from './lib/decoder.js'

function CarReader (multiformats) {
  return {
    async fromBytes (bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError('fromBytes() requires a Uint8Array')
      }
      return decodeComplete(multiformats, bytesReader(bytes))
    }
  }
}

export {
  CarReader
}
