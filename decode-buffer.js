import { decode } from './decoder.js'

function bufferReader (buf) {
  let pos = 0

  return {
    async upTo (length) {
      return buf.slice(pos, pos + Math.min(length, buf.length - pos))
    },

    async exactly (length) {
      if (length > buf.length - pos) {
        throw new Error('Unexpected end of data')
      }
      return buf.slice(pos, pos + length)
    },

    seek (length) {
      pos += length
    },

    get pos () {
      return pos
    },

    close () { }
  }
}

/**
 * @name Car.decodeBuffer
 * @description
 * Decode a `Uint8Array` representation of a Content ARchive (CAR) into an
 * in-memory representation:
 *
 * `{ version, roots[], blocks[] }`.
 *
 * Where `version` is always `1`, `roots` is an array of
 * [CID](https://ghub.io/cids)s and `blocks` is an array of IPLD blocks of the
 * form `{ cid, binary }`.
 *
 * Not intended to be part of the public API of datastore-car but may currently be
 * invoked via `require('datastore-car/lib/coding').decodeBuffer`, or
 * `require('datastore-car/lib/coding-browser').decodeBuffer` in a browser
 * environment.
 * @function
 * @memberof Car
 * @static
 * @async
 * @param {Uint8Array} buf the contents of a CAR
 * @returns {Car} an in-memory representation of a CAR file:
 * `{ version, roots[], blocks[] }`.
 */

async function decodeBuffer (multiformats, buf) {
  const reader = bufferReader(buf)
  return decode(multiformats, reader)
}

/* unnecessary, but this is possible:
function BufferDecoder (buf) {
  const reader = bufferReader(buf)
  return Decoder(reader)
}
*/

export default decodeBuffer
