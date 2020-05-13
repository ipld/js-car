const coding = require('./coding')
const { createFromDecoded, StreamingReader } = require('./reader-writer-iface')

async function createStreamCompleteReader (multiformats, stream) {
  const decoded = await coding.decodeStream(multiformats, stream)
  return createFromDecoded(decoded)
}

async function createStreamingReader (multiformats, stream) {
  const decoder = coding.StreamDecoder(multiformats, stream)
  return new StreamingReader(decoder)
}

async function createFileReader (multiformats, data) {
  const decoded = await coding.decodeFile(multiformats, data)
  return createFromDecoded(decoded)
}

module.exports.createStreamCompleteReader = createStreamCompleteReader
module.exports.createStreamingReader = createStreamingReader
module.exports.createFileReader = createFileReader
