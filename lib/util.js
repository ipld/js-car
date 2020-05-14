// { cid, binary }
function isBlock (block) {
  return typeof block === 'object' && isCID(block.cid) && isBuffer(block.binary)
}

function isCID (key) {
  return typeof key === 'object' &&
    isBuffer(key.buffer) &&
    isBuffer(key.multihash) &&
    (key.version === 0 || key.version === 1) &&
    typeof key.code === 'number'
    // don't handle old style CIDs
}

function isBuffer (b) {
  return (Buffer.isBuffer(b) || (
    b instanceof Uint8Array &&
    b.constructor.name === 'Uint8Array'))
}

function toKey (multiformats, key, method) {
  if (!isCID(key)) {
    try {
      key = new multiformats.CID(key.toString())
    } catch (e) {
      throw new TypeError(`${method}() only accepts CIDs or CID strings`)
    }
  }

  return key // cidToKey(key)
}

function verifyRoots (roots) {
  if (!Array.isArray(roots)) {
    roots = [roots]
  }
  for (const root of roots) {
    if (!isCID(root)) {
      throw new TypeError('Roots may only be a CID or an array of CIDs')
    }
  }
  return roots
}

module.exports.isBlock = isBlock
module.exports.isCID = isCID
module.exports.toKey = toKey
module.exports.verifyRoots = verifyRoots
