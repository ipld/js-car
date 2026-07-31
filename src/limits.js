/**
 * @typedef {import('./api.js').CarCodecOptions} CarCodecOptions
 * @typedef {Required<CarCodecOptions>} CarLimits
 */

// Matches go-car's DefaultMaxAllowedHeaderSize / DefaultMaxAllowedSectionSize
// (v2/internal/carv1/car.go).
export const DEFAULT_MAX_ALLOWED_HEADER_SIZE = 32 << 20 // 32MiB
export const DEFAULT_MAX_ALLOWED_SECTION_SIZE = 8 << 20 // 8MiB

/**
 * Validate a single provided cap. `undefined` is not "provided" and is left for
 * the caller to default. Rejects negatives, non-integers, NaN, Infinity and
 * non-numbers with a single predicate.
 *
 * @param {string} name
 * @param {number|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function resolve (name, value, fallback) {
  if (value === undefined) {
    return fallback
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer, got ${value}`)
  }
  return value
}

/**
 * Resolve a `CarCodecOptions` into a complete set of caps, applying the default
 * for each option left unset and validating any value provided.
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
