const CID = require('cids')

function toKey (key, method) {
  if (!CID.isCID(key)) {
    try {
      key = new CID(key.toString())
    } catch (e) {
      throw new TypeError(`${method}() only accepts CIDs or CID strings`)
    }
  }

  return cidToKey(key)
}

function cidToKey (cid) {
  return cid.toString() // cidv0 gets base58btc, v1 gets base32
}

function verifyRoots (roots) {
  if (!Array.isArray(roots)) {
    roots = [roots]
  }
  for (const root of roots) {
    if (!CID.isCID(root)) {
      throw new TypeError('Roots may only be a CID or an array of CIDs')
    }
  }
  return roots
}

module.exports.toKey = toKey
module.exports.cidToKey = cidToKey
module.exports.verifyRoots = verifyRoots
