V8_VERSION=$(shell node -e "console.log(process.versions.v8.substring(0, process.versions.v8.indexOf('-')))")
URL="https://raw.githubusercontent.com/v8/v8/refs/tags/${V8_VERSION}/include/v8-fast-api-calls.h"

.PHONY: library bench

bench/bench.so:
	cc -Wno-pointer-to-int-cast -O3 -march=native -mtune=native -shared -o bench/bench.so -s bench/bench.c

bench: bench/bench.so build/Release/ffast.node
	cd bench && bun bun-ffi.js && deno -A deno-ffi.js && node ffast.js

src/v8-fast-api-calls.h:
	echo "downloading src.v8-fast-api-calls.h"
	curl -s -L -o src/v8-fast-api-calls.h ${URL}

src/ffast.cc:
	npm run gen

node_modules/.bin/node-gyp:
	npm install

build/Release/ffast.node: src/ffast.cc src/v8-fast-api-calls.h node_modules/.bin/node-gyp
	node_modules/.bin/node-gyp --verbose rebuild

library:
	$(MAKE) build/Release/ffast.node

clean:
	rm -fr build
	rm -f src/ffast.cc
	rm -f src/v8-fast-api-calls.h
	rm -f bench/bench.so

cleanall:
	$(MAKE) clean
	rm -fr node_modules
	rm -fr package-lock.json