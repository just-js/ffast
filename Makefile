.PHONY: library bench

bench/bench.so:
	cc -Wno-pointer-to-int-cast -O3 -march=native -mtune=native -shared -o bench/bench.so -s bench/bench.c

bench: bench/bench.so build/Release/ffast.node
	cd bench && bun bun-ffi.js && deno -A deno-ffi.js && node ffast.js

src/v8-fast-api-calls.h:
	echo "downloading src.v8-fast-api-calls.h"
	V8_VERSION=$(node -e "console.log(process.versions.v8.substring(0, process.versions.v8.indexOf('-')))")
	URL="https://raw.githubusercontent.com/v8/v8/refs/tags/$V8_VERSION/include/v8-fast-api-calls.h"
	curl -s -L -o src/v8-fast-api-calls.h $URL

src/ffast.cc:
	node gen.js ffast

build/Release/ffast.node: src/ffast.cc src/v8-fast-api-calls.h
	node-gyp --verbose rebuild

library:
	$(MAKE) build/Release/ffast.node

clean:
	rm -fr build
	rm src/ffast.cc
	rm src/v8-fast-api-calls.h
	rm bench/bench.so
