# datastore-car (js-ds-car) [![Build Status](https://github.com/rvagg/js-ds-car/workflows/CI/badge.svg)](https://github.com/rvagg/js-ds-car/actions?workflow=CI)

[![NPM](https://nodei.co/npm/datastore-car.svg)](https://nodei.co/npm/datastore-car/)

A JavaScript Content ARchive (CAR) file reader and writer for for [IPLD](https://ipld.io) blocks. See original [Go implementation](https://github.com/ipfs/go-car).

Currently pre-v1 with working encoder and decoders operating on batches of blocks (each method is memory intensive at some point). Working toward a [Datastore](https://github.com/ipfs/interface-datastore) interface similar to [datastore-zipcar](https://github.com/rvagg/js-ds-zipcar) and some memory-efficient read and write options.

## API

### Contents

 * [`async Car.decodeFile(file)`](#Car__decodeFile)
 * [`async Car.decodeBuffer(buf)`](#Car__decodeBuffer)
 * [`async Car.decodeStream(stream)`](#Car__decodeStream)
 * [`async Car.encodeFile(file, roots, blocks)`](#Car__encodeFile)
 * [`async Car.encodeBuffer(roots, blocks)`](#Car__encodeBuffer)
 * [`Car.encodeStream(roots, blocks)`](#Car__encodeStream)

<a name="Car__decodeFile"></a>
### `async Car.decodeFile(file)`

Decode a Content ARchive (CAR) file into an in-memory representation:

`{ version, roots[], blocks[] }`.

Where `version` is always `1`, `roots` is an array of
[CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
[Block](https://ghub.io/@ipld/block)s.

**Parameters:**

* **`file`** _(`string`)_: the path to an existing CAR file.

**Return value**  _(`Car`)_: an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.

<a name="Car__decodeBuffer"></a>
### `async Car.decodeBuffer(buf)`

Decode a `Buffer` representation of a Content ARchive (CAR) into an in-memory representation:

`{ version, roots[], blocks[] }`.

Where `version` is always `1`, `roots` is an array of
[CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
[Block](https://ghub.io/@ipld/block)s.

**Parameters:**

* **`buf`** _(`Buffer`)_: the contents of a CAR

**Return value**  _(`Car`)_: an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.

<a name="Car__decodeStream"></a>
### `async Car.decodeStream(stream)`

Decode an entire Stream representing a Content ARchive (CAR) into an in-memory representation:

`{ version, roots[], blocks[] }`.

Where `version` is always `1`, `roots` is an array of
[CID](https://ghub.io/cids)s and `blocks` is an array of IPLD
[Block](https://ghub.io/@ipld/block)s.

**Parameters:**

* **`stream`** _(`ReadableStream`)_: a stream able to provide an entire CAR.

**Return value**  _(`Car`)_: an in-memory representation of a CAR file: `{ version, roots[], blocks[] }`.

<a name="Car__encodeFile"></a>
### `async Car.encodeFile(file, roots, blocks)`

Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, writing
to a file.

**Parameters:**

* **`file`** _(`string`)_: the path to a new CAR file to be written
* **`roots`** _(`Array.<CID>`)_: an array of root [CID](https://ghub.io/cids)s to set in the header
  of the archive. These are intended to be the merkle roots of all blocks.
* **`blocks`** _(`Array.<Block>`)_: an array of IPLD [Block](https://ghub.io/@ipld/block)s
  to append to the archive.

<a name="Car__encodeBuffer"></a>
### `async Car.encodeBuffer(roots, blocks)`

Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, returning
it as a single `Buffer`.

**Parameters:**

* **`roots`** _(`Array.<CID>`)_: an array of root [CID](https://ghub.io/cids)s to set in the header
  of the archive. These are intended to be the merkle roots of all blocks.
* **`blocks`** _(`Array.<Block>`)_: an array of IPLD [Block](https://ghub.io/@ipld/block)s
  to append to the archive.

**Return value**  _(`Buffer`)_: a `Buffer` representing the created archive.

<a name="Car__encodeStream"></a>
### `Car.encodeStream(roots, blocks)`

Encode a set of IPLD [Block](https://ghub.io/@ipld/block)s in CAR format, writing
the data to a stream.

There is currently no method to stream blocks into an encodeStream so you must have all
blocks in memory prior to encoding. Memory-efficient implementations coming soon.

**Parameters:**

* **`roots`** _(`Array.<CID>`)_: an array of root [CID](https://ghub.io/cids)s to set in the header
  of the archive. These are intended to be the merkle roots of all blocks.
* **`blocks`** _(`Array.<Block>`)_: an array of IPLD [Block](https://ghub.io/@ipld/block)s
  to append to the archive.

**Return value**  _(`ReadableStream`)_: a stream that the CAR will be written to.

## License and Copyright

Copyright 2019 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
