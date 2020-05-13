const coding = require('./coding-browser')
const { createFromDecoded } = require('./reader-writer-iface')

async function createBufferReader (multiformats, data) {
  const decoded = await coding.decodeBuffer(multiformats, data)
  return createFromDecoded(decoded)
}

module.exports.createBufferReader = createBufferReader
