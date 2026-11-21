import { createBlockVerifier, resolveHashers } from './block-verifier.js'

export { InvalidMultihashError, UnknownHashAlgorithmError } from './block-verifier.js'

/**
 * @typedef {import('./api.js').Block} Block
 * @typedef {import('./api.js').CarVerifyOptions} CarVerifyOptions
 */

/**
 * Check that a block's bytes hash to the multihash in its CID. sha2-256 and
 * identity are supported by default; pass `hashers` for others. Truncated
 * digests are supported where the hasher supports them.
 *
 * Returns a `Promise` only when the hasher is asynchronous; `await` the result
 * to handle both.
 *
 * @name verifyBlock(block[, options])
 * @param {Block} block
 * @param {Pick<CarVerifyOptions, 'hashers'>} [options] - See [Block Verification](#block-verification).
 * @returns {void | Promise<void>}
 * @throws {InvalidMultihashError} If the bytes don't match the CID.
 * @throws {UnknownHashAlgorithmError} If the CID's multihash is outside the configured hashers.
 */
export function verifyBlock (block, options) {
  return createBlockVerifier(resolveHashers(options?.hashers))(block)
}
