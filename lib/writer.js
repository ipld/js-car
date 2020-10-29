import { CID } from 'multiformats'
import { encodeWriter } from './encoder.js'

function toRoots (roots) {
  if (roots && roots.asCID === roots) {
    roots = [roots]
  }
  if (roots === undefined) {
    roots = []
  }
  if (!Array.isArray(roots)) {
    throw new TypeError('roots must be a single CID or an array of CIDs')
  }
  const _roots = []
  for (const root of roots) {
    const _root = CID.asCID(root)
    if (!_root) {
      throw new TypeError('roots must be a single CID or an array of CIDs')
    }
    _roots.push(_root)
  }
  return _roots
}

const CarWriter = {
  create (roots) {
    return encodeWriter(toRoots(roots))
  }
}

export default CarWriter
