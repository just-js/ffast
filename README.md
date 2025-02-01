# ffast

The fast (and dangerous 🐉) node.js FFI library

## Introduction

This is an initial Proof of Concept for surfacing all the lower level bindings
necessary into JS-land so we can generate FFI wrappers from JS itself, without
any dependencies on third party non-JS libraries like libffi or libtcc.

This should run on node.js current and LTS on Linux/x64. Additions will be made
shortly to allow building and running on macos/arm64 and Linux/arm64/raspberry pi.

It should also be possible to do the same on Windows and other platforms. It's will
*just* be a matter of implementing the assembler for the small subset of instructions
required to wrap standard C function calls and implementing the calling conventions
for the different OS's.

🐉🐉🐉 Beware! 🐉🐉🐉 
There are many dragons here. This is surfacing a lot of dangerous things
into JS-land which break things like JavaScript memory safety. It should be possible
to wrap this in an internal module and hide the unsafe things away, but further
research needs to be done on that front.

## Support

| OS | Arch | Supported | Planned |
| --- | --- | --- | --- |
| linux | x64 | :white_check_mark: | |
| linux | arm64 |  | :heavy_check_mark: |
| macos | x64 |  | :heavy_check_mark: |
| macos | arn64 |  | :heavy_check_mark: |
| windows | x64 | | :heavy_check_mark: |
| windows | x64 | | |
| android | arm64 | | |


## Building

### Requirements

- curl
- make
- a C++ compiler toolchain to compile the benchmark shared library
- node LTS (v22.13.1) or Current (v23.7.0) with ```npm``` and ```node-gyp```

### Makefile

```shell
$ make help
bench/bench.so                 build the shared library for the benchmarks
bench                          run the benchmark
src/v8-fast-api-calls.h        download the v8 fast api headers for current node/v8 version
src/ffast.cc                   generate the ffast node binding source
node_modules/.bin/node-gyp     install node-gyp locally
build/Release/ffast.node       build the ffast binding
library                        build the ffast binding
clean                          clean all the build artifacts except node_modules
cleanall                       clean everything including node_modules and package-lock.json

## build everything and run the benchmarks
$ make cleanall bench
```