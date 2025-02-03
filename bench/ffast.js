import { Bench } from './bench.js'
import { bind, dlopen, dlsym, RTLD_NOW, RTLD_LOCAL, assert } from '../lib/ffast.js'

const handle = assert(dlopen('./bench.so', RTLD_NOW | RTLD_LOCAL))
const void_no_args = bind(assert(dlsym(handle, 'void_no_args')), 'void', [])
const int32_no_args = bind(assert(dlsym(handle, 'int32_no_args')), 'i32', [])
const int32_one_int32_arg = bind(assert(dlsym(handle, 'int32_one_int32_arg')), 'i32', ['i32'])
const int32_two_int32_args = bind(assert(dlsym(handle, 'int32_two_int32_args')), 'i32', ['i32', 'i32'])
const int32_three_int32_args = bind(assert(dlsym(handle, 'int32_three_int32_args')), 'i32', ['i32', 'i32', 'i32'])
const void_one_pointer_arg = bind(assert(dlsym(handle, 'void_one_pointer_arg')), 'void', ['pointer'])
const int32_one_pointer_arg = bind(assert(dlsym(handle, 'int32_one_pointer_arg')), 'i32', ['pointer'])

const runs = 1000000000
const iter = 10

const bench = new Bench()
bench.name_width = 32
const ptr = Math.pow(2, 31) - 1

for (let j = 0; j < iter; j++) {
  bench.start('noop')
  for (let i = 0; i < runs; i++) {
    assert(void_no_args() === undefined)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_no_args')
  for (let i = 0; i < runs; i++) {
    assert(int32_no_args() === 1)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_one_int32_arg')
  for (let i = 0; i < runs; i++) {
    assert(int32_one_int32_arg(i) === i + i)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_two_int32_args')
  for (let i = 0; i < runs; i++) {
    assert(int32_two_int32_args(1, 2) === 3)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_three_int32_args')
  for (let i = 0; i < runs; i++) {
    assert(int32_three_int32_args(1, 2, 3) === 6)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('void_one_pointer_arg')
  for (let i = 0; i < runs; i++) {
    assert(void_one_pointer_arg(ptr) === undefined)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_one_pointer_arg')
  for (let i = 0; i < runs; i++) {
    assert(int32_one_pointer_arg(ptr) === ptr)
  }
  bench.end(runs)
}
