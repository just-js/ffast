import { Bench } from './bench.js'

const { symbols: { 
  void_no_args, int32_no_args, int32_one_int32_arg, void_one_pointer_arg,
  int32_one_pointer_arg, int32_two_int32_args, int32_three_int32_args
 } } = Deno.dlopen('./bench.so', { 
  void_no_args: { parameters: [], result: 'void', },
  int32_no_args: { parameters: [], result: 'i32', },
  int32_one_int32_arg: { parameters: ['i32'], result: 'i32', },
  int32_two_int32_args: { parameters: ['i32', 'i32'], result: 'i32', },
  int32_three_int32_args: { parameters: ['i32', 'i32', 'i32'], result: 'i32', },
  void_one_pointer_arg: { parameters: ['pointer'], result: 'void', },
  int32_one_pointer_arg: { parameters: ['pointer'], result: 'i32', },
})

const runs = 1000000000
const iter = 10
const bench = new Bench()
bench.name_width = 32

const ptr_val = Math.pow(2, 31) - 1
const ptr = Deno.UnsafePointer.create(ptr_val)

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
    assert(int32_one_pointer_arg(ptr) === ptr_val)
  }
  bench.end(runs)
}
