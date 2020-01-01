const fs = require('fs')
const CarDatastore = require('./')
const Block = require('@ipld/block')

async function example () {
  const block = Block.encoder(Buffer.from('random meaningless bytes'), 'raw')
  const cid = await block.cid()

  const outStream = fs.createWriteStream('example.car')
  const writeDs = await CarDatastore.writeStream(outStream)

  // set the header with a single root
  await writeDs.setRoots(cid)
  // store a new block, creates a new file entry in the CAR archive
  await writeDs.put(cid, await block.encode())
  await writeDs.close()

  const inStream = fs.createReadStream('example.car')
  // read and parse the entire stream so we have `get()` and `has()` methods
  // use readStreaming(inStream) to support efficient stream decoding with
  // just query() available for iterative reads.
  const readDs = await CarDatastore.readStreamComplete(inStream)

  // read the list of roots from the header
  const roots = await readDs.getRoots()
  // retrieve a block, as a UInt8Array, reading from the ZIP archive
  const got = await readDs.get(roots[0])
  // also possible: for await (const {key, data} = readDs.query()) { ... }

  console.log('Retrieved [%s] from example.car with CID [%s]',
    Buffer.from(got).toString(),
    roots[0].toString())

  await readDs.close()
}

example().catch((err) => {
  console.error(err)
  process.exit(1)
})
