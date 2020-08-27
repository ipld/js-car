// { cid, binary }
function isBlock (block) {
  return typeof block === 'object' && isCID(block.cid) && isBuffer(block.binary)
}

function isCID (key) {
  return typeof key === 'object' &&
    isBuffer(key.bytes) &&
    isBuffer(key.multihash) &&
    (key.version === 0 || key.version === 1) &&
    typeof key.code === 'number'
    // don't handle old style CIDs
}

function isBuffer (b) {
  return b instanceof ArrayBuffer || ArrayBuffer.isView(b)
}

function toKey (multiformats, key, method) {
  if (!isCID(key)) {
    try {
      key = multiformats.CID.from(key.toString())
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

export { isBlock, isCID, toKey, verifyRoots }
