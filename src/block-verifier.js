import { equals } from 'multiformats/bytes'
import { identity } from 'multiformats/hashes/identity'
import { sha256 } from 'multiformats/hashes/sha2'

/**
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./api.js').CarVerifyOptions} CarVerifyOptions
 * @typedef {import('multiformats/cid').CID} CID
 * @typedef {import('multiformats/hashes/interface').MultihashHasher} MultihashHasher
 * @typedef {import('multiformats/hashes/interface').MultihashDigest} MultihashDigest
 * @typedef {(block: Block) => void | Promise<void>} Verifier
 */

/**
 * Thrown when a block's bytes don't hash to the multihash in its CID.
 */
export class InvalidMultihashError extends Error {
  /**
   * @param {string} message
   * @param {ErrorOptions} [options]
   */
  constructor (message, options) {
    super(message, options)
    this.name = 'InvalidMultihashError'
  }
}

/**
 * Thrown when a block's CID uses a multihash outside the configured hashers.
 */
export class UnknownHashAlgorithmError extends Error {
  /**
   * @param {string} message
   */
  constructor (message) {
    super(message)
    this.name = 'UnknownHashAlgorithmError'
  }
}

/**
 * Resolve reader options to a verifier, or `undefined` when verification is
 * off.
 *
 * @param {CarVerifyOptions} [options]
 * @returns {Verifier | undefined}
 */
export function createVerifier (options) {
  const verify = options?.verify
  if (verify !== undefined && typeof verify !== 'boolean') {
    throw new TypeError(`verify must be a boolean, got ${String(verify)}`)
  }
  const hashers = resolveHashers(options?.hashers)
  return verify ? createBlockVerifier(hashers) : undefined
}

/**
 * Run a verifier where only a synchronous result can be used.
 *
 * @param {Verifier} verifier
 * @param {Block} block
 */
export function verifySync (verifier, block) {
  const result = verifier(block)
  if (isPromise(result)) {
    result.catch(() => {})
    const { code } = block.cid.multihash
    throw new TypeError(`Hasher for multihash code 0x${code.toString(16)} is asynchronous; synchronous readers need a hasher that returns synchronously`)
  }
}

/**
 * @param {unknown} hashers
 * @returns {Map<number, MultihashHasher>}
 */
export function resolveHashers (hashers) {
  /** @type {Map<number, MultihashHasher>} */
  const map = new Map([[sha256.code, sha256]])
  if (hashers === undefined) {
    return map
  }
  if (!Array.isArray(hashers)) {
    throw new TypeError(`hashers must be an array of MultihashHashers, got ${String(hashers)}`)
  }
  for (const hasher of hashers) {
    if (typeof hasher?.code !== 'number' || typeof hasher.digest !== 'function') {
      throw new TypeError(`hashers must be an array of MultihashHashers, got an entry ${String(hasher)}`)
    }
    // a later entry replaces an earlier one, including the built-in sha2-256
    map.set(hasher.code, hasher)
  }
  return map
}

/**
 * @param {Map<number, MultihashHasher>} hashers
 * @returns {Verifier}
 */
export function createBlockVerifier (hashers) {
  return ({ cid, bytes }) => {
    const expected = cid.multihash
    if (expected.code === identity.code) {
      // the digest is the content: match exactly, never truncate
      if (!equals(expected.digest, bytes)) {
        throw mismatch(cid)
      }
      return
    }
    const hasher = hashers.get(expected.code)
    if (!hasher) {
      throw new UnknownHashAlgorithmError(`Missing hasher for multihash code 0x${expected.code.toString(16)} (CID ${cid}); add one to the hashers option`)
    }

    /** @param {MultihashDigest} actual */
    const compare = (actual) => {
      if (!equals(actual.digest, expected.digest)) {
        throw mismatch(cid)
      }
    }

    return digest(hasher, bytes, cid, undefined, (actual) => {
      if (actual.digest.length <= expected.size) {
        return compare(actual)
      }
      // a truncated CID: rehash so the hasher applies its own truncation limits
      return digest(hasher, bytes, cid, expected.size, compare)
    })
  }
}

/**
 * Hash `bytes` and pass the digest to `next`, synchronously when the hasher
 * allows. Hasher failures, sync or async, become `InvalidMultihashError`s.
 *
 * @param {MultihashHasher} hasher
 * @param {Uint8Array} bytes
 * @param {CID} cid
 * @param {number | undefined} truncate
 * @param {(digest: MultihashDigest) => void | Promise<void>} next
 * @returns {void | Promise<void>}
 */
function digest (hasher, bytes, cid, truncate, next) {
  /** @type {MultihashDigest | Promise<MultihashDigest>} */
  let result
  try {
    result = hasher.digest(bytes, truncate === undefined ? undefined : { truncate })
  } catch (err) {
    throw unable(cid, err)
  }
  if (isPromise(result)) {
    return result.then(next, (err) => { throw unable(cid, err) })
  }
  return next(result)
}

/**
 * @param {CID} cid
 */
function mismatch (cid) {
  return new InvalidMultihashError(`Block bytes do not match the multihash of ${cid}`)
}

/**
 * @param {CID} cid
 * @param {unknown} err
 */
function unable (cid, err) {
  return new InvalidMultihashError(`Unable to verify ${cid}: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
}

/**
 * @template T
 * @param {T | Promise<T>} value
 * @returns {value is Promise<T>}
 */
function isPromise (value) {
  return typeof (/** @type {any} */ (value))?.then === 'function'
}
