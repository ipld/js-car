/* eslint-env mocha */

import * as CarBufferWriter from '@ipld/car/buffer-writer'
import { createHeader } from "../lib/encoder.js"
import { assert } from './common.js'
import { CID } from 'multiformats'

describe('CarBufferWriter', () => {
  const cid = CID.parse('bafkreifuosuzujyf4i6psbneqtwg2fhplc2wxptc5euspa2gn3bwhnihfu')
  describe("estimateHeader", async () => {


    for (const count of [0, 1, 10, 18, 24, 48, 124, 255, 258, 65536 - 1, 65536]) {
      it(`estimateHeaderCapacity(${count})`, () => {
        const roots = new Array(count).fill(cid)
        assert.deepEqual(CarBufferWriter.estimateHeaderSize(count), createHeader(roots).byteLength)
      })
    }

  })
})
