# datastore-car (js-datastore-car) [![Build Status](https://github.com/rvagg/js-datastore-car/workflows/CI/badge.svg)](https://github.com/rvagg/js-datastore-car/actions?workflow=CI)

[![NPM](https://nodei.co/npm/datastore-car.svg)](https://nodei.co/npm/datastore-car/)

A JavaScript Content ARchive (CAR) file reader and writer for for [IPLD](https://ipld.io) blocks. See original [Go implementation](https://github.com/ipfs/go-car).

The interface wraps a [Datastore](https://github.com/ipfs/interface-datastore), similar to [datastore-zipcar](https://github.com/rvagg/js-ds-zipcar) and has multiple create-modes for different use-cases, including memory-efficient read and write options.

## Example

```js
const fs = require('fs')
const CarDatastore = require('datastore-car')
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
  // retrieve a block, as a UInt8Array, reading from the CAR archive
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
```

Will output:

```
Retrieved [random meaningless bytes] from example.car with CID [bafkreihwkf6mtnjobdqrkiksr7qhp6tiiqywux64aylunbvmfhzeql2coa]
```

In this example, the `writeStream()` create-mode is used to generate the CAR file, this allows for an iterative write process where first the roots are set (`setRoots()`) and then all of the blocks are written (`put()`). After it is created, we use the `readStreamComplete()` create-mode to read the contents. Other create-modes are useful where the environment, data and needs demand:

* **[`CarDatastore.readBuffer(buffer)`](#CarDatastore__readBuffer)**: read a CAR archive from a `Buffer` or `Uint8Array`. Does not support mutation operations, only reads. This mode is not efficient for large data sets but does support `get()` and `has()` operations since it caches the entire archive in memory. This mode is the only mode _available_ in a browser environment
* **[`CarDatastore.readFileComplete(file)`](#CarDatastore__readFileComplete)**: read a CAR archive directly from a file. Does not support mutation operations, only reads. This mode is not efficient for large data sets but does support `get()` and `has()` operations since it caches the entire archive in memory. This mode is _not available_ in a browser environment.
* **[`CarDatastore.readStreamComplete(stream)`](#CarDatastore__readStreamComplete)**: read a CAR archive directly from a stream. Does not support mutation operations, only reads. This mode is not efficient for large data sets but does support `get()` and `has()` operations since it caches the entire archive in memory. This mode is _not available_ in a browser environment.
* **[`CarDatastore.readStreaming(stream)`](#CarDatastore__readStreaming)**: read a CAR archive directly from a stream. Does not support mutation operations, and only supports iterative reads via `query()` (i.e. no `get()` and `has()`). This mode is very efficient for large data sets. This mode is _not available_ in a browser environment.
* **[`CarDatastore.writeStream(stream)`](#CarDatastore__writeStream)**: write a CAR archive to a stream (e.g. `fs.createWriteStream(file)`). Does not support read operations, only writes, and the writes are append-only (i.e. no `delete()`). However, this mode is very efficient for dumping large data sets, with no caching and streaming writes. This mode is _not available_ in a browser environment.

Other create-modes may be supported in the future, such as writing to a Buffer (although this is already possible if you couple `writeStream()` with a [`BufferListStream`](https://ghub.io/bl)) or a read/write mode such as datastore-zipcar makes available.

## API

### Contents

 * [`async CarDatastore.readBuffer(buffer)`](#CarDatastore__readBuffer)
 * [`async CarDatastore.readFileComplete(file)`](#CarDatastore__readFileComplete)
 * [`async CarDatastore.readStreamComplete(stream)`](#CarDatastore__readStreamComplete)
 * [`async CarDatastore.readStreaming(stream)`](#CarDatastore__readStreaming)
 * [`async CarDatastore.writeStream(stream)`](#CarDatastore__writeStream)
 * [`class CarDatastore`](#CarDatastore)
 * [`async CarDatastore#get(key)`](#CarDatastore_get)
 * [`async CarDatastore#has(key)`](#CarDatastore_has)
 * [`async CarDatastore#put(key, value)`](#CarDatastore_put)
 * [`async CarDatastore#delete(key)`](#CarDatastore_delete)
 * [`async CarDatastore#setRoots(comment)`](#CarDatastore_setRoots)
 * [`async CarDatastore#getRoots()`](#CarDatastore_getRoots)
 * [`async CarDatastore#close()`](#CarDatastore_close)
 * [`async CarDatastore#query([q])`](#CarDatastore_query)
 * [`async CarDatastore.indexer(input)`](#CarDatastore__indexer)
 * [`async CarDatastore.readRaw(fd)`](#CarDatastore__readRaw)

<a name="CarDatastore__readBuffer"></a>
### `async CarDatastore.readBuffer(buffer)`

Read a CarDatastore from a Buffer containing the contents of an existing
CAR archive. Mutation operations (`put()`, `delete()` and `setRoots()`) are
not available.

Because the entire CAR archive is represented in memory after being parsed,
this read-mode is not suitable for large data sets. `readStreaming()` should
be used instead for a streaming read supporting only `query()` for an
iterative decode.

However, this create-mode is currently the only mode supported in a browser
environment.

**Parameters:**

* **`buffer`** _(`Buffer|Uint8Array`)_: the byte contents of a CAR archive

**Return value**  _(`CarDatastore`)_: a read-only CarDatastore.

<a name="CarDatastore__readFileComplete"></a>
### `async CarDatastore.readFileComplete(file)`

Read a CAR archive from a file and return a CarDatastore. The CarDatastore
returned will _only_ support read operations: `getRoots()`, `get()`, `has()`
and `query()`. Caching makes `get()` and `has()` possible as the entire
file is read and decoded before the CarDatastore is returned. mutation
operations (`put()`, `delete()` and `setRoots()`) are not available as there
is no ability to modify the archive.

This create-mode is functionally similar to calling:
`CarDatastore.readStreamComplete(fs.createReadStream(path))`
However, this create-mode uses raw `fs.read()` operations to seek through
the file as required rather than wrapping the consumption in a ReadableStream
with its fixed chunk size. This distinction is unlikely to make a difference
until a non-buffering `readFile()` create-mode is exposed.

Because the entire CAR archive is represented in memory after being parsed,
this create-mode is not suitable for large data sets. `readStreaming()`
should be used insead for a streaming read supporting only `query()` for an
iterative decode.

This create-mode is not available in the browser environment.

**Parameters:**

* **`file`** _(`string`)_: a path to a file containing CAR archive data.

**Return value**  _(`CarDatastore`)_: a read-only CarDatastore.

<a name="CarDatastore__readStreamComplete"></a>
### `async CarDatastore.readStreamComplete(stream)`

Read a CAR archive as a CarDataStore from a ReadableStream. The CarDatastore
returned will _only_ support read operations: `getRoots()`, `get()`, `has()`
and `query()`. Caching makes `get()` and `has()` possible as the entire
stream is read and decoded before the CarDatastore is returned. Mutation
operations (`put()`, `delete()` and `setRoots()`) are not available as there
is no ability to modify the archive.

Because the entire CAR archive is represented in memory after being parsed,
this create-mode is not suitable for large data sets. `readStreaming()` should
be used instead for a streaming read supporting only `query()` for an
iterative decode.

This create-mode is not available in the browser environment.

**Parameters:**

* **`stream`** _(`ReadableStream`)_: a ReadableStream that provides an entire CAR
  archive as a binary stream.

**Return value**  _(`CarDatastore`)_: a read-only CarDatastore.

<a name="CarDatastore__readStreaming"></a>
### `async CarDatastore.readStreaming(stream)`

Read a CAR archive as a CarDataStore from a ReadableStream. The CarDatastore
returned will _only_ support `getRoots()` and an iterative `query()` call.
As there is no caching, individual `get()` or `has()` operations are not
possible and mutation operations (`put()`, `delete()` and `setRoots()`) are
not available as there is no ability to modify the archive.

`readStreaming()` is an efficient create-mode, useful for reading large CAR
archives without using much memory. Its support for a simple iterative
`query()` method make its utility as a general Datastore very limited.

`readStreamComplete()` is an alternative stream decoding create-mode that uses
buffering to decode an entire stream into an in-memory representation of the
CAR archive. This may be used if `get()` and `has()` operations are required
and the amount of data is manageable in memory.

This create-mode is not available in the browser environment.

**Parameters:**

* **`stream`** _(`ReadableStream`)_: a ReadableStream that provides an entire CAR
  archive as a binary stream.

**Return value**  _(`CarDatastore`)_: a read-only CarDatastore.

<a name="CarDatastore__writeStream"></a>
### `async CarDatastore.writeStream(stream)`

Create a CarDatastore that writes a CAR archive to a WritableStream. The
CarDatastore returned will _only_ support append operations (`put()` and
`setRoots()`, but not `delete()`) and no caching will be performed, with
entries written directly to the provided stream.

Because the roots are encoded in the header of a CAR file, a call to
`setRoots()` must be made prior to any `put()` operation. Absent of a
`setRoots()` call, the header will be encoded with an empty list of root
CIDs. A call to `setRoots()` after one or more calls to `put()` will result
in an Error being thrown.

`writeStream()` is an efficient create-mode, useful for writing large amounts
of data to CAR archive as long as the roots are known before writing.

This create-mode is not available in a browser environment.

**Parameters:**

* **`stream`** _(`WritableStream`)_: a writable stream

**Return value**  _(`CarDatastore`)_: an append-only, streaming CarDatastore.

<a name="CarDatastore"></a>
### `class CarDatastore`

CarDatastore is a class to manage reading from, and writing to a CAR archives
using [CID](https://github.com/multiformats/js-cid)s as keys and file names
in the CAR and binary block data as the file contents.

<a name="CarDatastore_get"></a>
### `async CarDatastore#get(key)`

Retrieve a block from this archive. `key`s are converted to `CID`
automatically, whether you provide a native Datastore `Key` object, a
`String` or a `CID`. `key`s that cannot be converted will throw an error.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

**Return value**  _(`Buffer`)_: the IPLD block data referenced by the CID.

<a name="CarDatastore_has"></a>
### `async CarDatastore#has(key)`

Check whether a block exists in this archive. `key`s are converted to `CID`
automatically, whether you provide a native Datastore `Key` object, a
`String` or a `CID`. `key`s that cannot be converted will throw an error.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

**Return value**  _(`boolean`)_: indicating whether the key exists in this Datastore.

<a name="CarDatastore_put"></a>
### `async CarDatastore#put(key, value)`

Store a block in this archive. `key`s are converted to `CID` automatically,
whether you provide a native Datastore `Key` object, a `String` or a `CID`.
`key`s that cannot be converted will throw an error.

Only supported by the `CarDatastore.writeStream()` create-mode.
CarDatastores constructed by other create-modes will not support `put()`
and an Error will be thrown when it is called.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the `value`.
* **`value`** _(`Buffer|Uint8Array`)_: an IPLD block matching the given `key`
  `CID`.

<a name="CarDatastore_delete"></a>
### `async CarDatastore#delete(key)`

**Currently not supported by any create-mode**. CarDatastore is currently
an append-only and read-only construct.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

<a name="CarDatastore_setRoots"></a>
### `async CarDatastore#setRoots(comment)`

Set the list of roots in the CarDatastore archive on this CAR archive.

The roots will be written to the comment section of the CAR archive when
`close()` is called, in the meantime it is stored in memory.

Only supported by the `CarDatastore.writeStream()` create-mode.
CarDatastores constructed by other create-modes will not support `put()`
and an Error will be thrown when it is called.

**Parameters:**

* **`comment`** _(`string`)_: an arbitrary comment to store in the CAR archive.

<a name="CarDatastore_getRoots"></a>
### `async CarDatastore#getRoots()`

Get the list of roots set on this CAR archive if they exist exists. See
[`CarDatastore#setRoots`](#CarDatastore_setRoots).

**Return value**  _(`Array.<CID>`)_: an array of CIDs

<a name="CarDatastore_close"></a>
### `async CarDatastore#close()`

Close this archive, free resources and write its new contents if required
and supported by the create-mode used.

This may or may not have any effect on the use of the underlying resource
depending on the create-mode of the CarDatastore.

<a name="CarDatastore_query"></a>
### `async CarDatastore#query([q])`

Create an async iterator for the entries of this CarDatastore. Ideally for
use with `for await ... of` to lazily iterate over the entries.

By default, each element returned by the iterator will be an object with a
`key` property with the string CID of the entry and a `value` property with
the binary data.

Supply `{ keysOnly: true }` as an argument and the elements will only
contain the keys, without needing to load the values from storage.

The `filters` parameter is also supported as per the Datastore interface.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported.

**Parameters:**

* **`q`** _(`Object`, optional)_: query parameters

**Return value**  _(`AsyncIterator.<key, value>`)_

<a name="CarDatastore__indexer"></a>
### `async CarDatastore.indexer(input)`

Index a CAR without decoding entire blocks. This operation is similar to
`CarDatastore.readStreaming()` except that it _doesn't_ reutrn a CarDatastore
and it skips over block data. It returns the array of root CIDs as well as
an AsyncIterator that will yield index data for each block in the CAR.

The index data provided by the AsyncIterator can be stored externally and
used to read individual blocks directly from the car (using
`CarDatastore.readRaw()`).

```js
const { indexer } = require('datastore-car')

async function run () {
  const index = await indexer('big.car')
  index.roots = index.roots.map((cid) => cid.toString())
  console.log('roots:', index.roots)
  for await (const blockIndex of index.iterator) {
    blockIndex.cid = blockIndex.cid.toString()
    console.log('block:', blockIndex)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

Might output something like:

```
roots: [
  'bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm',
  'bafyreidj5idub6mapiupjwjsyyxhyhedxycv4vihfsicm2vt46o7morwlm'
]
block: {
  cid: 'bafyreihyrpefhacm6kkp4ql6j6udakdit7g3dmkzfriqfykhjw6cad5lrm',
  length: 55,
  offset: 137
}
block: {
  cid: 'QmNX6Tffavsya4xgBi2VJQnSuqy9GsxongxZZ9uZBqp16d',
  length: 97,
  offset: 228
}
block: {
  cid: 'bafkreifw7plhl6mofk6sfvhnfh64qmkq73oeqwl6sloru6rehaoujituke',
  length: 4,
  offset: 362
}
...
```

**Parameters:**

* **`input`** _(`string|ReadableStream`)_: either a string path name to a CAR file
  or a ReadableStream that provides CAR archive data.

**Return value**  _(`Object.<Array.<roots:CID>, iterator:AsyncIterator>`)_: an object containing a
  `roots` array of CIDs and an `iterator` AsyncIterator that will yield
  Objects of the form `{ cid:CID, offset:number, length:number }` indicating
  the CID of the block located at start=`offset` with a length of `number` in
  the CAR archive provided.

<a name="CarDatastore__readRaw"></a>
### `async CarDatastore.readRaw(fd)`

Read a block directly from a CAR file given an block index provided by
`CarDatastore.indexer()` (i.e. an object of the form:
`{ cid:CID, offset:number, length:number }`).

**Parameters:**

* **`fd`** _(`number|FileHandle`)_: an open file descriptor, either an integer from
  `fs.open()` or a `FileHandle` on `fs.promises.open()`.

**Return value**  _(`Block`)_: an IPLD [Block](https://ghub.io/@ipld/block) object.

## License and Copyright

Copyright 2019 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
