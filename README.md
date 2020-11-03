# @ipld/car

A JavaScript Content Addressable aRchive (CAR) file reader and writer.

See also:

 * Original [Go implementation](https://github.com/ipfs/go-car)
 * [CAR specification](https://github.com/ipld/specs/blob/master/block-layer/content-addressable-archives.md)
 * [IPLD](https://ipld.io)

## Example

```js
// Create a simple .car file with a single block and that block's CID as the
// single root. Then read the .car and fetch the block again.

import fs from 'fs'
import { Readable } from 'stream'
import { CarReader, CarWriter } from '@ipld/car'
import raw from 'multiformats/codecs/raw'
import CID from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

async function example () {
  const bytes = new TextEncoder().encode('random meaningless bytes')
  const hash = await sha256.digest(raw.encode(bytes))
  const cid = CID.create(1, raw.code, hash)

  // create the writer and set the header with a single root
  const { writer, out } = await CarWriter.create([cid])
  Readable.from(out).pipe(fs.createWriteStream('example.car'))

  // store a new block, creates a new file entry in the CAR archive
  await writer.put({ cid, bytes })
  await writer.close()

  const inStream = fs.createReadStream('example.car')
  // read and parse the entire stream in one go, this will cache the contents of
  // the car in memory so is not suitable for large files.
  const reader = await CarReader.fromIterable(inStream)

  // read the list of roots from the header
  const roots = await reader.getRoots()
  // retrieve a block, as a { cid:CID, bytes:UInt8Array } pair from the archive
  const got = await reader.get(roots[0])
  // also possible: for await (const { cid, bytes } of CarIterator.fromIterable(inStream)) { ... }

  console.log('Retrieved [%s] from example.car with CID [%s]',
    new TextDecoder().decode(got.bytes),
    roots[0].toString())
}

example().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Will output:

```
Retrieved [random meaningless bytes] from example.car with CID [bafkreihwkf6mtnjobdqrkiksr7qhp6tiiqywux64aylunbvmfhzeql2coa]
```

## API

### Contents

 * [`class CarBlockIterator`](#CarBlockIterator)
 * [`class CarReader`](#CarReader)
 * [`async CarReader#getRoots()`](#CarReader_getRoots)
 * [`async CarReader#has(key)`](#CarReader_has)
 * [`async CarReader#get(key)`](#CarReader_get)
 * [`async * CarReader#blocks()`](#CarReader_blocks)
 * [`async * CarReader#cids()`](#CarReader_cids)
 * [`async CarReader.fromBytes(bytes)`](#CarReader__fromBytes)
 * [`async CarReader.fromIterable(asyncIterable)`](#CarReader__fromIterable)
 * [`async CarReader.readRaw(fd, blockIndex)`](#CarReader__readRaw)

<a name="CarBlockIterator"></a>
### `class CarBlockIterator`

Provides blockstore-like access to a CAR.

Implements the `RootsReader` interface:
[`getRoots()`](#CarReader__getRoots). And the `BlockReader` interface:
[`get()`](#CarReader__get), [`has()`](#CarReader__has),
[`blocks()`](#CarReader__blocks) (defined as a `BlockIterator`) and
[`cids()`](#CarReader__cids) (defined as a `CIDIterator`).

<a name="CarReader"></a>
### `class CarReader`

Properties:

* `version` `(number)`: The version number of the CAR referenced by this reader (should be `1`).

Provides blockstore-like access to a CAR.

Implements the `RootsReader` interface:
[`getRoots()`](#CarReader__getRoots). And the `BlockReader` interface:
[`get()`](#CarReader__get), [`has()`](#CarReader__has),
[`blocks()`](#CarReader__blocks) (defined as a `BlockIterator`) and
[`cids()`](#CarReader__cids) (defined as a `CIDIterator`).

Load this class with either `import CarReader from '@ipld/car/reader'`
(`const CarReader = require('@ipld/car/reader')`). Or
`import { CarReader } from '@ipld/car'` (`const { CarReader } = require('@ipld/car')`).

<a name="CarReader_getRoots"></a>
### `async CarReader#getRoots()`

* Returns:  `Promise<CID[]>`

Get the list of roots defined by the CAR referenced by this reader. May be
zero or more `CID`s.

<a name="CarReader_has"></a>
### `async CarReader#has(key)`

* `key` `(CID)`

* Returns:  `Promise<boolean>`

Check whether a given `CID` exists within the CAR referenced by this
reader.

<a name="CarReader_get"></a>
### `async CarReader#get(key)`

* `key` `(CID)`

* Returns:  `Promise<(Block|undefined)>`

Fetch a `Block` (a `{ cid:CID, bytes:Uint8Array }` pair) from the CAR
referenced by this reader matching the provided `CID`. In the case where
the provided `CID` doesn't exist within the CAR, `undefined` will be
returned.

<a name="CarReader_blocks"></a>
### `async * CarReader#blocks()`

* Returns:  `AsyncGenerator<Block>`

Returns a `BlockIterator` (`AsyncIterable<Block>`) that iterates over all
of the `Block`s (`{ cid:CID, bytes:Uint8Array }` pairs) contained within
the CAR referenced by this reader.

<a name="CarReader_cids"></a>
### `async * CarReader#cids()`

* Returns:  `AsyncGenerator<CID>`

Returns a `CIDIterator` (`AsyncIterable<CID>`) that iterates over all of
the `CID`s contained within the CAR referenced by this reader.

<a name="CarReader__fromBytes"></a>
### `async CarReader.fromBytes(bytes)`

* `bytes` `(Uint8Array)`

* Returns:  `Promise<CarReader>`: blip blop

Instantiate a [`CarReader`](#CarReader) from a `Uint8Array` blob. This performs a
decode fully in memory and maintains the decoded state in memory for full
access to the data via the `CarReader` API.

<a name="CarReader__fromIterable"></a>
### `async CarReader.fromIterable(asyncIterable)`

* `asyncIterable` `(AsyncIterable<Uint8Array>)`

* Returns:  `Promise<CarReader>`

Instantiate a [`CarReader`](#CarReader) from a `AsyncIterable<Uint8Array>`, such as
a [modern Node.js stream](https://nodejs.org/api/stream.html#stream_streams_compatibility_with_async_generators_and_async_iterators).
This performs a decode fully in memory and maintains the decoded state in
memory for full access to the data via the `CarReader` API.

Care should be taken for large archives; this API may not be appropriate
where memory is a concern or the archive is potentially larger than the
amount of memory that the runtime can handle.

<a name="CarReader__readRaw"></a>
### `async CarReader.readRaw(fd, blockIndex)`

* `fd` `(fs.promises.FileHandle|number)`: A file descriptor from the
  Node.js `fs` module. Either an integer, from `fs.open()` or a `FileHandle`
  from `fs.promises.open()`.
* `blockIndex` `(BlockIndex)`: An index pointing to the location of the
  Block required. This `BlockIndex` should take the form:
  `{cid:CID, blockLength:number, blockOffset:number}`.

* Returns:  `Promise<Block>`: A `{ cid:CID, bytes:Uint8Array }` pair.

Reads a block directly from a file descriptor for an open CAR file. This
function is **only available in Node.js** and not a browser environment.

This function can be used in connection with [`CarIndexer`](#CarIndexer) which emits
the `BlockIndex` objects that are required by this function.

The user is responsible for opening and closing the file used in this call.

## License and Copyright

Copyright 2019 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
