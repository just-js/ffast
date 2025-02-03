# ffast

The fast (and dangerous 🐉) node.js FFI library

## Introduction

This is an initial Proof of Concept for surfacing all the lower level bindings
necessary into JS-land so we can generate FFI wrappers from JS itself, without
any dependencies on third party non-JS libraries like ```libffi``` or ```libtcc```.

This should run on [```node.js```](https://nodejs.org) current and LTS on ```Linux x64/arm64``` and ```macos arm64```. 
It has been tested on ```Raspberry Pi 3B+``` which has a ```Cortex A53``` and works fine there.
It will also probably work on older versions of ```node.js``` but will need to be 
rebuilt for older versions of V8 that ```node.js``` embeds. Please report on issues
you find.

It currently supports (with bugs and pretty much zero safety) passing any ```integer```
types, ```strings``` and ```pointers```. float support and struct passing will be coming a
little later. There are benchmarks coming soon that will show how to do callbacks
from ```C/C++``` to ```JS``` too.

It should be pretty easy to add a lot of libraries to this using the [bindings
definitions](https://github.com/just-js/lo/tree/main/lib) that already exist for the [lo](https://github.com/just-js/lo) runtime. It should also be possible to 
run this on [```Bun```](https://bun.sh) if there is some work done on Bun side to add symbols for the 
V8 fastcall api's (which won't have any effect on Bun/JSC).

Windows support should not be a lot of work (famous last words!).

Right now assumption is 64-bit platforms only.

🐉🐉🐉 Beware! 🐉🐉🐉 
There are many dragons here. This is surfacing a lot of dangerous things
into JS-land which break things like JavaScript memory safety. It should be possible
to wrap this in an internal module and hide the unsafe things away, but further
research needs to be done on that front. The goal rn is to see how fast we can go
with few if any guardrails. We can then measure the overhead any safety features
we add have on the baseline implementation.

## Support

| OS | Arch | Supported | Planned |
| --- | --- | --- | --- |
| linux | x64 | :white_check_mark: | |
| linux | arm64 | :white_check_mark: | |
| macos | x64 |  | :heavy_check_mark: |
| macos | arn64 | :white_check_mark: | |
| windows | x64 | | :heavy_check_mark: |
| windows | x64 | | :heavy_check_mark: |
| android | arm64 | | :heavy_check_mark: |

## Building

### Requirements

- curl
- make
- a C compiler toolchain to compile the benchmark shared library
- a C++ compiler toolchain to compile the bindings
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