### [4.1.1](https://github.com/ipld/js-car/compare/v4.1.0...v4.1.1) (2022-04-20)


### Bug Fixes

* ts not happy with bare assert() anymore ([7a61bdf](https://github.com/ipld/js-car/commit/7a61bdf87494cbf796b4ba1632b48c878fd80953))


### Trivial Changes

* **deps-dev:** bump standard from 16.0.4 to 17.0.0 ([216954d](https://github.com/ipld/js-car/commit/216954d8182c2ead0f60b94c70b128332f86e1fc))
* **no-release:** bump actions/setup-node from 3.0.0 to 3.1.0 ([#72](https://github.com/ipld/js-car/issues/72)) ([8ac6f47](https://github.com/ipld/js-car/commit/8ac6f47ceafe1f66117b4b535861c9b2196dfe47))
* **no-release:** bump actions/setup-node from 3.1.0 to 3.1.1 ([#73](https://github.com/ipld/js-car/issues/73)) ([2b1fd8c](https://github.com/ipld/js-car/commit/2b1fd8c4b8cad91ffbae7b3b9cc505282e62ab13))

## [4.1.0](https://github.com/ipld/js-car/compare/v4.0.0...v4.1.0) (2022-03-31)


### Features

* buffered writer ([#70](https://github.com/ipld/js-car/issues/70)) ([b1dd34b](https://github.com/ipld/js-car/commit/b1dd34ba2af5d000f81b615a0bcd8793dcbbd2d1))

## [4.0.0](https://github.com/ipld/js-car/compare/v3.2.4...v4.0.0) (2022-03-04)


### ⚠ BREAKING CHANGES

* add CARv2 read support (data only, ignoring index)

### Features

* add CARv2 read support (data only, ignoring index) ([99cd346](https://github.com/ipld/js-car/commit/99cd3467cb36eedc075b27ebe4cc7b46e05294e8))


### Bug Fixes

* deal with c8 Node.js v12 bug ([8f83849](https://github.com/ipld/js-car/commit/8f83849ea5e11461b743c3931b0155559c89e3ac))


### Trivial Changes

* add header validation via schema, allow for !=1 version ([d260597](https://github.com/ipld/js-car/commit/d260597d87404c6ca57c2c92424317209116cc1f))
* allow access to full header in CarReader ([b95a6e2](https://github.com/ipld/js-car/commit/b95a6e2b0d8559d63e3c63c11694e67636c65e5d))
* **carv2:** add fixtures and test expectations from go-car ([d563acf](https://github.com/ipld/js-car/commit/d563acfb1bd93c124e717767b1c4084a23ee09bb))
* **docs:** update docs to include decoder.* functions. ([9200ffe](https://github.com/ipld/js-car/commit/9200ffe263de55264a1fc0418ddc2b09dbaa1d8c))
* **no-release:** bump actions/checkout from 2.4.0 to 3 ([#67](https://github.com/ipld/js-car/issues/67)) ([ae56ce5](https://github.com/ipld/js-car/commit/ae56ce58c492d69340903d641545b84adc7b760f))
* test for rejecting recursive carv2 header ([12480b5](https://github.com/ipld/js-car/commit/12480b5874c17b40a488f465c7c390bda458b20a))

### [3.2.4](https://github.com/ipld/js-car/compare/v3.2.3...v3.2.4) (2022-03-02)


### Trivial Changes

* **deps-dev:** bump typescript from 4.5.5 to 4.6.2 ([#66](https://github.com/ipld/js-car/issues/66)) ([84e8c4d](https://github.com/ipld/js-car/commit/84e8c4dd9094724f16185ba3a4265300985569d2))
* **no-release:** bump @types/node from 16.11.14 to 17.0.0 ([#63](https://github.com/ipld/js-car/issues/63)) ([4f01b28](https://github.com/ipld/js-car/commit/4f01b280179a9892465277e4063c8581dd9ebc19))
* **no-release:** bump actions/setup-node from 2.5.0 to 2.5.1 ([#64](https://github.com/ipld/js-car/issues/64)) ([a53d5c7](https://github.com/ipld/js-car/commit/a53d5c77d30f998b45a534e20d0f174574c58cd5))
* **no-release:** bump actions/setup-node from 2.5.1 to 3.0.0 ([#65](https://github.com/ipld/js-car/issues/65)) ([9f3df06](https://github.com/ipld/js-car/commit/9f3df0640472aa36ccb2b8081a0fe5a7c75ca0de))

### [3.2.3](https://github.com/ipld/js-car/compare/v3.2.2...v3.2.3) (2021-12-13)


### Trivial Changes

* **deps:** bump @ipld/dag-cbor from 6.0.15 to 7.0.0 ([6daa36c](https://github.com/ipld/js-car/commit/6daa36c601a48bb740c9f776491a10478b25b847))
* **no-release:** bump @ipld/dag-cbor from 6.0.15 to 7.0.0 in /examples ([#62](https://github.com/ipld/js-car/issues/62)) ([18f6787](https://github.com/ipld/js-car/commit/18f6787785aae2904ca11fcafbfc20e023e081c5))

### [3.2.2](https://github.com/ipld/js-car/compare/v3.2.1...v3.2.2) (2021-12-10)


### Bug Fixes

* remove double typecheck run in CI ([d1871cc](https://github.com/ipld/js-car/commit/d1871cc0cdee750850b260f525778c5111156107))

### [3.2.1](https://github.com/ipld/js-car/compare/v3.2.0...v3.2.1) (2021-12-09)


### Trivial Changes

* use semantic-release, update testing ([9a34587](https://github.com/ipld/js-car/commit/9a345871eaf0c3418c7e75f317f9ade0d4c0a88b))
