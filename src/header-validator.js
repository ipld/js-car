/* eslint-disable jsdoc/check-indentation, max-depth */

/**
 * Auto-generated with @ipld/schema@v4.2.0 at Thu Sep 14 2023 from IPLD Schema:
 *
 * # CarV1HeaderOrV2Pragma is a more relaxed form, and can parse {version:x} where
 * # roots are optional. This is typically useful for the {verison:2} CARv2
 * # pragma.
 *
 * type CarV1HeaderOrV2Pragma struct {
 *   roots optional [&Any]
 *   # roots is _not_ optional for CarV1 but we defer that check within code to
 *   # gracefully handle the V2 case where it's just {version:X}
 *   version Int
 * }
 *
 * # CarV1Header is the strict form of the header, and requires roots to be
 * # present. This is compatible with the CARv1 specification.
 *
 * # type CarV1Header struct {
 * #   roots [&Any]
 * #   version Int
 * # }
 *
 */

const Kinds = {
  Null: /**
         * @param obj
         * @returns {undefined|null}
         */ (/** @type {any} */ obj) => obj === null ? obj : undefined,
  Int: /**
        * @param obj
        * @returns {undefined|number}
        */ (/** @type {any} */ obj) => Number.isInteger(obj) ? obj : undefined,
  Float: /**
          * @param obj
          * @returns {undefined|number}
          */ (/** @type {any} */ obj) => typeof obj === 'number' && Number.isFinite(obj) ? obj : undefined,
  String: /**
           * @param obj
           * @returns {undefined|string}
           */ (/** @type {any} */ obj) => typeof obj === 'string' ? obj : undefined,
  Bool: /**
         * @param obj
         * @returns {undefined|boolean}
         */ (/** @type {any} */ obj) => typeof obj === 'boolean' ? obj : undefined,
  Bytes: /**
          * @param obj
          * @returns {undefined|Uint8Array}
          */ (/** @type {any} */ obj) => obj instanceof Uint8Array ? obj : undefined,
  Link: /**
         * @param obj
         * @returns {undefined|object}
         */ (/** @type {any} */ obj) => obj !== null && typeof obj === 'object' && obj.asCID === obj ? obj : undefined,
  List: /**
         * @param obj
         * @returns {undefined|Array<any>}
         */ (/** @type {any} */ obj) => Array.isArray(obj) ? obj : undefined,
  Map: /**
        * @param obj
        * @returns {undefined|object}
        */ (/** @type {any} */ obj) => obj !== null && typeof obj === 'object' && obj.asCID !== obj && !Array.isArray(obj) && !(obj instanceof Uint8Array) ? obj : undefined
}
/** @type {{ [k in string]: (obj:any)=>undefined|any}} */
const Types = {
  'CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)': Kinds.Link,
  'CarV1HeaderOrV2Pragma > roots (anon)': /**
                                           * @param obj
                                           * @returns {undefined|any}
                                           */ (/** @type {any} */ obj) => {
    if (Kinds.List(obj) === undefined) {
      return undefined
    }
    for (let i = 0; i < obj.length; i++) {
      let v = obj[i]
      v = Types['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v)
      if (v === undefined) {
        return undefined
      }
      if (v !== obj[i]) {
        const ret = obj.slice(0, i)
        for (let j = i; j < obj.length; j++) {
          let v = obj[j]
          v = Types['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v)
          if (v === undefined) {
            return undefined
          }
          ret.push(v)
        }
        return ret
      }
    }
    return obj
  },
  Int: Kinds.Int,
  CarV1HeaderOrV2Pragma: /**
                          * @param obj
                          * @returns {undefined|any}
                          */ (/** @type {any} */ obj) => {
    if (Kinds.Map(obj) === undefined) {
      return undefined
    }
    const entries = Object.entries(obj)
    /** @type {{[k in string]: any}} */
    let ret = obj
    let requiredCount = 1
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i]
      switch (key) {
        case 'roots':
          {
            const v = Types['CarV1HeaderOrV2Pragma > roots (anon)'](obj[key])
            if (v === undefined) {
              return undefined
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {}
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1]
                }
              }
              ret.roots = v
            }
          }
          break
        case 'version':
          {
            requiredCount--
            const v = Types.Int(obj[key])
            if (v === undefined) {
              return undefined
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {}
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1]
                }
              }
              ret.version = v
            }
          }
          break
        default:
          return undefined
      }
    }

    if (requiredCount > 0) {
      return undefined
    }
    return ret
  }
}
/** @type {{ [k in string]: (obj:any)=>undefined|any}} */
const Reprs = {
  'CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)': Kinds.Link,
  'CarV1HeaderOrV2Pragma > roots (anon)': /**
                                           * @param obj
                                           * @returns {undefined|any}
                                           */ (/** @type {any} */ obj) => {
    if (Kinds.List(obj) === undefined) {
      return undefined
    }
    for (let i = 0; i < obj.length; i++) {
      let v = obj[i]
      v = Reprs['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v)
      if (v === undefined) {
        return undefined
      }
      if (v !== obj[i]) {
        const ret = obj.slice(0, i)
        for (let j = i; j < obj.length; j++) {
          let v = obj[j]
          v = Reprs['CarV1HeaderOrV2Pragma > roots (anon) > valueType (anon)'](v)
          if (v === undefined) {
            return undefined
          }
          ret.push(v)
        }
        return ret
      }
    }
    return obj
  },
  Int: Kinds.Int,
  CarV1HeaderOrV2Pragma: /**
                          * @param obj
                          * @returns {undefined|any}
                          */ (/** @type {any} */ obj) => {
    if (Kinds.Map(obj) === undefined) {
      return undefined
    }
    const entries = Object.entries(obj)
    /** @type {{[k in string]: any}} */
    let ret = obj
    let requiredCount = 1
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i]
      switch (key) {
        case 'roots':
          {
            const v = Reprs['CarV1HeaderOrV2Pragma > roots (anon)'](value)
            if (v === undefined) {
              return undefined
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {}
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1]
                }
              }
              ret.roots = v
            }
          }
          break
        case 'version':
          {
            requiredCount--
            const v = Reprs.Int(value)
            if (v === undefined) {
              return undefined
            }
            if (v !== value || ret !== obj) {
              if (ret === obj) {
                /** @type {{[k in string]: any}} */
                ret = {}
                for (let j = 0; j < i; j++) {
                  ret[entries[j][0]] = entries[j][1]
                }
              }
              ret.version = v
            }
          }
          break
        default:
          return undefined
      }
    }
    if (requiredCount > 0) {
      return undefined
    }
    return ret
  }
}

export const CarV1HeaderOrV2Pragma = {
  toTyped: Types.CarV1HeaderOrV2Pragma,
  toRepresentation: Reprs.CarV1HeaderOrV2Pragma
}
