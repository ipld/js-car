const coding = require('./coding')
const { createFromDecoded, StreamingReader } = require('./reader-writer-iface')

async function createStreamCompleteReader (stream) {
  const decoded = await coding.decodeStream(stream)
  return createFromDecoded(decoded)
}

async function createStreamingReader (stream) {
  const decoder = coding.StreamDecoder(stream)
  return new StreamingReader(decoder)
}

async function createFileReader (data) {
  const decoded = await coding.decodeFile(data)
  return createFromDecoded(decoded)
}

module.exports.createStreamCompleteReader = createStreamCompleteReader
module.exports.createStreamingReader = createStreamingReader
module.exports.createFileReader = createFileReader
