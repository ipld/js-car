const coding = require('./coding-browser')
const { createFromDecoded } = require('./reader-writer-iface')

async function createBufferReader (data) {
  const decoded = await coding.decodeBuffer(data)
  return createFromDecoded(decoded)
}

module.exports.createBufferReader = createBufferReader
