CC=cc
V8_VERSION=$(shell node -e "console.log(process.versions.v8.substring(0, process.versions.v8.indexOf('-')))")
URL="https://raw.githubusercontent.com/v8/v8/refs/tags/${V8_VERSION}/include/v8-fast-api-calls.h"
SQLITE_PATH=../lo/lib/sqlite/deps/sqlite

.PHONY: library bench help

help:
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9\/_\.-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

bench/sqlite-baseline: bench/sqlite-baseline.c ## build the sqlite c application for the benchmarks
	${CC} -O3 -ffast-math -c -march=native -mtune=native -fno-exceptions -fno-asynchronous-unwind-tables -ffunction-sections -fdata-sections -I${SQLITE_PATH} bench/sqlite-baseline.c -o baseline.o
	${CC} -O3 -static -s -march=native -mtune=native -fno-exceptions -fno-asynchronous-unwind-tables -ffunction-sections -fdata-sections -o bench/sqlite-baseline baseline.o ${SQLITE_PATH}/libsqlite3.a -lm
#	${CC} -O3 -static -s -march=native -mtune=native -fno-exceptions -fno-asynchronous-unwind-tables -ffunction-sections -fdata-sections -o bench/sqlite-baseline baseline.o -lsqlite3 -lm

bench/bench.so: bench/bench.c ## build the shared library for the benchmarks
	${CC} -g -Wno-pointer-to-int-cast -O3 -march=native -mtune=native -shared -o bench/bench.so bench/bench.c

bench: bench/bench.so build/Release/ffast.node ## run the benchmark
	npm run bench | tee bench.log
	npm run chart

src/v8-fast-api-calls.h: ## download the v8 fast api headers for current node/v8 version
	echo "downloading src.v8-fast-api-calls.h"
	curl -s -L -o src/v8-fast-api-calls.h ${URL}

src/ffast.cc: ## generate the ffast node binding source
	npm run gen

node_modules/.bin/node-gyp: ## install node-gyp locally
	npm install

build/Release/ffast.node: src/ffast.cc src/v8-fast-api-calls.h node_modules/.bin/node-gyp ## build the ffast binding
	node_modules/.bin/node-gyp --verbose rebuild

library: ## build the ffast binding
	$(MAKE) build/Release/ffast.node

clean: ## clean all the build artifacts except node_modules
	rm -fr build
	rm -f src/ffast.cc
	rm -f src/v8-fast-api-calls.h
	rm -f bench/bench.so
	rm -f *.o
	rm -f bench/sqlite-baseline

cleanall: ## clean everything including node_modules and package-lock.json
	$(MAKE) clean
	rm -fr node_modules
	rm -fr package-lock.json