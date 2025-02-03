import { dlopen,  FFIType, ptr } from "bun:ffi";
import { Bench } from './bench.js'

const { symbols: { 
  void_no_args, int32_no_args, int32_one_int32_arg, void_one_pointer_arg,
  int32_one_pointer_arg, int32_two_int32_args, int32_three_int32_args
 } } = dlopen('./bench.so', { 
  void_no_args: { args: [], returns: FFIType.void, },
  int32_no_args: { args: [], returns: FFIType.i32, },
  int32_one_int32_arg: { args: [FFIType.i32], returns: FFIType.i32, },
  int32_two_int32_args: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32, },
  int32_three_int32_args: { args: [FFIType.i32, FFIType.i32, FFIType.i32], returns: FFIType.i32, },
  void_one_pointer_arg: { args: [FFIType.pointer], returns: FFIType.void, },
  int32_one_pointer_arg: { args: [FFIType.pointer], returns: FFIType.i32, },
})

const runs = 300000000
const iter = 10
const bench = new Bench()
bench.name_width = 32

const p = Math.pow(2, 31) - 1

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
    assert(void_one_pointer_arg(p) === undefined)
  }
  bench.end(runs)
}

for (let j = 0; j < iter; j++) {
  bench.start('int32_one_pointer_arg')
  for (let i = 0; i < runs; i++) {
    assert(int32_one_pointer_arg(p) === p)
  }
  bench.end(runs)
}
