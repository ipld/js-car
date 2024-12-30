import fs from 'fs'
import { promisify } from 'util'

const hasFS = Boolean(fs)

export { hasFS }

/**
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
  if (!_fsReadFn) {
    _fsReadFn = promisify(fs.read)
  }
  return _fsReadFn(fd, buffer, offset, length, position)
}

/**
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
  if (!_fsWriteFn) {
    _fsWriteFn = promisify(fs.write)
  }
  return _fsWriteFn(fd, buffer, offset, length, position)
}
