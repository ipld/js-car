import fs from 'fs'
import { promisify } from 'util'

export { fs }

/**
 * @description not happy with typing here, but it's needed for the `promisify(fs.read)` function.
 * @type {any}
 */
let _fsReadFn
/**
 * @description This function is needed not to initialize the `fs.read` on load time. To run in cf workers without polyfill.
 * @param {number} fd
 * @param {Uint8Array} buffer
 * @param {number} offset
 * @param {number} length
 * @param {number} position
 * @returns {Promise<{ bytesRead: number, buffer: Uint8Array }>}
 */
export function fsread (fd, buffer, offset, length, position) {
  _fsReadFn = _fsReadFn || promisify(fs.read)
  return _fsReadFn(fd, buffer, offset, length, position)
}

/**
 * @description not happy with typing here, but it's needed for the `promisify(fs.write)` function.
 * @type {any}
 */
let _fsWriteFn
/**
 * @description This function is needed not to initialize the `fs.write` on load time. To run in cf workers without polyfill.
 * @param {number} fd
 * @param {Uint8Array} buffer
 * @param {number} offset
 * @param {number} length
 * @param {number} position
 * @returns {Promise<{ bytesRead: number, buffer: Uint8Array }>}
 */
export function fswrite (fd, buffer, offset, length, position) {
  _fsWriteFn = _fsWriteFn || promisify(fs.write)
  return _fsWriteFn(fd, buffer, offset, length, position)
}
