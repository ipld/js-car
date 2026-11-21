/**
 * @typedef {import('./api.js').CarCodecOptions} CarCodecOptions
 * @typedef {Required<CarCodecOptions>} CarLimits
 */

// go-car's DefaultMaxAllowedHeaderSize and DefaultMaxAllowedSectionSize
export const DEFAULT_MAX_ALLOWED_HEADER_SIZE = 32 << 20 // 32MiB
export const DEFAULT_MAX_ALLOWED_SECTION_SIZE = 8 << 20 // 8MiB
// go-cid's maxDigestAlloc, bounds a multihash digest independent of the
// section cap
export const MAX_DIGEST_SIZE = 32 << 20 // 32MiB

/**
 * @param {string} name
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function resolve (name, value, fallback) {
  if (value === undefined) {
    return fallback
  }
  if (typeof value !== 'number' || !(Number.isSafeInteger(value) || value === Infinity)) {
    throw new TypeError(`${name} must be a non-negative integer or Infinity, got ${String(value)}`)
  }
  if (value < 0) {
    throw new RangeError(`${name} must be a non-negative integer or Infinity, got ${value}`)
  }
  return value
}

/**
 * Apply defaults to, and validate, user-supplied size limits.
 *
 * @param {CarCodecOptions} [options]
 * @returns {CarLimits}
 */
export function resolveLimits (options) {
  return {
    maxAllowedHeaderSize: resolve('maxAllowedHeaderSize', options?.maxAllowedHeaderSize, DEFAULT_MAX_ALLOWED_HEADER_SIZE),
    maxAllowedSectionSize: resolve('maxAllowedSectionSize', options?.maxAllowedSectionSize, DEFAULT_MAX_ALLOWED_SECTION_SIZE)
  }
}

/**
 * @param {number} length
 * @param {number} max
 */
export function assertHeaderSize (length, max) {
  if (length > max) {
    throw new RangeError(`CAR header of length ${length} exceeds maxAllowedHeaderSize of ${max}`)
  }
}

/**
 * @param {number} length
 * @param {number} max
 */
export function assertSectionSize (length, max) {
  if (length > max) {
    throw new RangeError(`CAR section of length ${length} exceeds maxAllowedSectionSize of ${max}`)
  }
}

/**
 * @param {number} length
 */
export function assertDigestSize (length) {
  if (length > MAX_DIGEST_SIZE) {
    throw new RangeError(`CID digest of length ${length} exceeds maximum of ${MAX_DIGEST_SIZE}`)
  }
}
