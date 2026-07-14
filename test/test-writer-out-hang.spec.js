/* eslint-env mocha */

import { CarWriter } from '../src/writer.js'
import { assert, makeData } from './common.js'

// Repro for the CarWriter `out` hang.
//
// When the write path rejects (any error thrown from setRoots/writeBlock) the
// writer's internal `_mutex` is poisoned: put()/close() reject correctly, but the
// paired `out` AsyncIterable is never told, so it never ends. A consumer draining
// `out` (for-await, Readable.from(out), stream.pipeline) hangs forever.
//
// This test FAILS today: the `out` drain never settles, so the timeout fires. The
// fix should make `out` terminate (reject or end) once the writer has errored.
describe('CarWriter out hang on a write-path error', () => {
  it('out terminates when a put() rejects, instead of hanging', async () => {
    const { cborBlocks } = await makeData()
    const { writer, out } = CarWriter.create([cborBlocks[0].cid])

    // Simulate any error thrown while writing a block. (On a branch with size
    // caps an over-cap block throws here for real; the mechanism is identical.)
    writer._encoder.writeBlock = () => Promise.reject(new Error('write failed'))

    // Drain `out` continuously so backpressure is relieved and the header writes.
    const drained = (async () => {
      const chunks = []
      for await (const chunk of out) {
        chunks.push(chunk)
      }
      return chunks
    })()

    await assert.isRejected(writer.put(cborBlocks[1]), /write failed/)

    // `out` should now settle (end or reject) since the writer has errored. It
    // does not today, so race the drain against a timeout to surface the hang.
    await Promise.race([
      drained.then(() => {}, () => {}), // either end or reject is acceptable
      new Promise((resolve, reject) => setTimeout(() => reject(new Error('`out` never terminated (hang)')), 300))
    ])
  })
})
