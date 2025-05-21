import { createRequire } from "node:module"

const ffast = createRequire(import.meta.url)('../build/Release/ffast.node')

const { Assembler, Registers } = await import(`./${process.arch}.js`)

const isatty = process.stdout.isTTY;
const AD = isatty ? "\u001b[0m" : ""; // ANSI Default
const A0 = isatty ? "\u001b[30m" : ""; // ANSI Black
const AR = isatty ? "\u001b[31m" : ""; // ANSI Red
const AG = isatty ? "\u001b[32m" : ""; // ANSI Green
const AY = isatty ? "\u001b[33m" : ""; // ANSI Yellow
const AB = isatty ? "\u001b[34m" : ""; // ANSI Blue
const AM = isatty ? "\u001b[35m" : ""; // ANSI Magenta
const AC = isatty ? "\u001b[36m" : ""; // ANSI Cyan
const AW = isatty ? "\u001b[37m" : ""; // ANSI White
const colors = { AD, AG, AY, AM, AD, AR, AB, AC, AW, A0 };
const Types = {
  i8: 1, i16: 2, i32: 3, u8: 4, u16: 5, u32: 6, void: 7, f32: 8, f64: 9,
  u64: 10, i64: 11, iSize: 12, uSize: 13, pointer: 14, buffer: 15, function: 16,
  u32array: 17, bool: 18, string: 19
}

function needs_unwrap (t) {
  switch (t) {
    case Types.buffer:
    case Types.pointer:
    case Types.u32array:
    case Types.u64:
    case Types.i64:
      return true
    default:
      return false
  }
}

function ptr (u8) {
  u8.ptr = get_address(u8)
  u8.size = u8.byteLength
  return u8
}

function assert (condition, message, ErrorType = Error) {
  if (!condition) {
    if (message && message.constructor.name === 'Function') {
      throw new ErrorType(message(condition))
    }
    throw new ErrorType(message || "Assertion failed")
  }
  return condition
}

function stack_size (params) {
  let n = Math.max(params.length - 6, 0)
  if (n % 2 > 0) n++
  return n * 8
}

function wrap (handle, fn, plen = 0) {
  const call = fn
  const params = (new Array(plen)).fill(0).map((_, i) => `p${i}`).join(', ')
  const f = new Function(
    'handle',
    'call',
    `return function ${fn.name} (${params}) {
    call(${params}${plen > 0 ? ', ' : ''}handle);
    return handle[0] + ((2 ** 32) * handle[1]);
  }`,)
  const fun = f(handle, call)
  if (fn.state) fun.state = fn.state
  if (fn.handle) fun.handle = fn.handle
  return fun
}

function platform_x64 () {
  const { rdi, rsi, rdx, rcx, r8, r9, rsp, rax, rbx } = Registers

  function compile_slowcall (address, result, params) {
    asm.reset()
    asm.push(rbx)
    asm.movreg(rdi, rbx)
    // todo we could just push rdi and use it instead of rbx
    const size = stack_size(params)
    if (size > 0) asm.sub(rsp, size)
    let state_off = 56
    let stack_off = 0
    for (let i = 0; i < Math.min(params.length, max_args); i++) {
      const type = params[i]
      if (i === 0) {
        // todo, function map/vtable
        if (type === Types.f32 || type === Types.f64) {
          // todo
          //asm.mov(rbx, xmm0, 8)
        } else {
          asm.movsrc(rbx, rdi, 8) // we start at offset 8 as first slot is for the result
        }
      } else if (i === 1) {
        asm.movsrc(rbx, rsi, 16)
      } else if (i === 2) {
        asm.movsrc(rbx, rdx, 24)
      } else if (i === 3) {
        asm.movsrc(rbx, rcx, 32)
      } else if (i === 4) {
        asm.movsrc(rbx, r8, 40)
      } else if (i === 5) {
        asm.movsrc(rbx, r9, 48)
      } else {
        asm.movsrc(rbx, rax, state_off)
        asm.movdest(rax, rsp, stack_off)
        state_off += 8
        stack_off += 8
      }
    }
    asm.call(address)
    if (result !== Types.void) {
      if (result === Types.f32 || result === Types.f64) {
        // todo
        //asm.mov(xmm0, rbx, null, 0)
      } else {
  //      asm.movabs(Math.pow(2, 31), rax)
        asm.movdest(rax, rbx, 0)
      }
    }
    if (size > 0) asm.add(rsp, size)
    asm.pop(rbx)
    asm.ret()
    return compiler.compile(asm.bytes())
  }

  function compile_fastcall (address, result, params) {
    asm.reset()
    let size = stack_size(params)
    let caller_off = size + 8
    let stack_off = 0
    // if we don't have any arguments and the return does not need to be 
    // unwrapped then we can just let v8 call the target directly
//    if (params.length === 0 && !needs_unwrap(result)) return address
    if (size > 0) {
      asm.sub(rsp, size)
    }
    for (let i = 0; i < Math.min(params.length, max_args); i++) {
      if (i === 0) {
        if (params[i] === Types.buffer || params[i] === Types.u32array) {
          asm.movsrc(rsi, rdi, 8)
        } else if (params[i] === Types.string) {
          asm.movsrc(rsi, rdi, 0)
        } else {
          asm.movreg(rsi, rdi)
        }
      } else if (i === 1) {
        if (params[i] === Types.buffer || params[i] === Types.u32array) {
          asm.movsrc(rdx, rsi, 8)
        } else if (params[i] === Types.string) {
          asm.movsrc(rdx, rsi, 0)
        } else {
          asm.movreg(rdx, rsi)
        }
      } else if (i === 2) {
        if (params[i] === Types.buffer || params[i] === Types.u32array) {
          asm.movsrc(rcx, rdx, 8)
        } else if (params[i] === Types.string) {
          asm.movsrc(rcx, rdx, 0)
        } else {
          asm.movreg(rcx, rdx)
        }
      } else if (i === 3) {
        asm.movreg(r8, rcx)
      } else if (i === 4) {
        asm.movreg(r9, r8)
      } else if (i === 5) {
        asm.movsrc(rsp, r9, caller_off)
        caller_off += 8
      } else {
        asm.movsrc(rsp, rax, caller_off)
        asm.movdest(rax, rsp, stack_off)
        caller_off += 8
        stack_off += 8
      }
    }
    if (needs_unwrap(result)) {
//      asm.movsrc(rsp, rax, caller_off)
//      asm.movdest(rax, rsp, stack_off)
    }
    if (size > 0) {
      asm.call(address)
      asm.add(rsp, size)
      asm.ret()
    } else {
      asm.jmp(address)
    }
    return compiler.compile(asm.bytes())
  }
  return { compile_slowcall, compile_fastcall }
}

function platform_arm64 () {
  const { x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11, x12, x13, x14, x15, x16, x17, x19, x29, x30, sp } = Registers

  function compile_fastcall (address, result, params) {
    asm.reset()
    const size = stack_size(params)
    if (size > 0) asm.sub(sp, sp, size)

    let r = 0
    for (let i = 0; i < Math.min(params.length, max_args); i++) {
      asm.movreg(Registers[`x${r + 1}`], Registers[`x${r}`])
      r += 1
    }

    asm.movabs(x17, address)
    asm.br(x17)

    return compiler.compile(asm.bytes())
  }

  function compile_slowcall (address, result, params) {
    asm.reset()
    const size = stack_size(params)
    if (size > 0) asm.sub(sp, sp, size)
    if (result === Types.void) {
      asm.movabs(x17, address)

      asm.movreg(x0, x16)
      asm.ldp(x0, x1, x16, 8)

      asm.br(x17)
    } else {
      asm.movabs(x17, address)
      asm.movreg(x0, x16)
      let off = 8
      let r = 0
      for (let i = 0; i < Math.min(params.length, max_args); i++) {
        //asm.ldp(x0, x1, x16, 8)
        asm.ldr(x16, Registers[`x${r++}`], off)
        off += 8
      }

      asm.stp(x29, x30, sp, -16)
      asm.blr(x17)
      asm.ldp(x29, x30, sp, 16)

      asm.stri(x0, x16, 0)
      asm.ret()
    }
    return compiler.compile(asm.bytes())
  }

  return { compile_slowcall, compile_fastcall }
}

function platform_specific () {
  if (process.arch === 'x64' && (process.platform === 'darwin' || process.platform === 'linux')) {
    return platform_x64()
  } else if (process.arch === 'arm64' && (process.platform === 'darwin' || process.platform === 'linux')) {
    return platform_arm64()
  }
}

const { compile_slowcall, compile_fastcall } = platform_specific()

function bind_custom (res = 'void', params = [], slow_address = 0, fast_address = 0) {
  if (!slow_address) throw new Error('address for slow function is missing')
  const state = ptr(new Uint8Array(struct_fastcall_size))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  params = params.map(n => Types[n])
  const maxParam = Math.min(params.length, max_args)
  const slowcall_target = slow_address
  if (fast_address) {
    const fastcall_target = fast_address
    // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
    //        this slot is also used to receive result in %rax
    dv.setBigUint64(fastcall_pointer_off, BigInt(fastcall_target), true)
  }
  // 8:     set return type
  dv.setUint8(return_type_off, result)
  // 9:     set length of params
  dv.setUint8(param_length_off, maxParam)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < maxParam; i++) dv.setUint8(param_types_off + i, params[i])
  // 104:    set function call pointer to state->fn slot (for slowcall)
  dv.setBigUint64(slowcall_pointer_off, BigInt(slowcall_target), true)
  // todo: wrap here
  const generated_fun = fast_address ? bind_fastcall(state.ptr) : 
    bind_slowcall(state.ptr)
  // keep the state alive
  generated_fun._state = state
  return needs_unwrap(result) ? wrap(handle, generated_fun, 
    params.length) : generated_fun
}

function bind (address, res = 'void', params = [], slow = false) {
  const state = ptr(new Uint8Array(struct_fastcall_size))
  const dv = new DataView(state.buffer)
  const result = Types[res]
  params = params.map(n => Types[n])
  const maxParam = Math.min(params.length, max_args)
  const slowcall_target = compile_slowcall(address, result, params)
  const slow_src = asm.src
  let fast_src
  if (!slow) {
    const fastcall_target = compile_fastcall(address, result, params)
    // 0-7:   set the fastcall wrapper pointer to first 64-bit slot in state
    //        this slot is also used to receive result in %rax
    dv.setBigUint64(fastcall_pointer_off, BigInt(fastcall_target), true)
    fast_src = asm.src
  }
  // 8:     set return type
  dv.setUint8(return_type_off, result)
  // 9:     set length of params
  dv.setUint8(param_length_off, maxParam)
  // 10-39: set param types - max 30 params
  for (let i = 0; i < maxParam; i++) dv.setUint8(param_types_off + i, params[i])
  // 104:    set function call pointer to state->fn slot (for slowcall)
  dv.setBigUint64(slowcall_pointer_off, BigInt(slowcall_target), true)
  // todo: wrap here
  const generated_fun = slow ? bind_slowcall(state.ptr) : 
    bind_fastcall(state.ptr)
  // keep the state alive
  generated_fun._state = state
  generated_fun.slow_src = slow_src
  generated_fun.fast_src = fast_src
  generated_fun.handle = new Uint32Array(2)
  // todo: we could just use the state for the handle here
  return needs_unwrap(result) ? wrap(generated_fun.handle, generated_fun, 
    params.length) : generated_fun
}

function bindall (api, addr = 0) {
  const binding = {}
  for (const key of Object.keys(api)) {
    const { name, result, parameters } = api[key]
    binding[key] = bind(assert(dlsym(addr, name || key)), result, parameters)
  }
  return binding
}

class Compiler {
  // TODO: this could just be static
  compile (code) {
    if (!code.ptr) ptr(code)
    const address = mmap(0, code.length, PROT_WRITE, MAP_ANONYMOUS | MAP_PRIVATE, 
      -1, handle)
    assert(address)
    assert(memcpy(address, code.ptr, code.length) === address)
    assert(mprotect(address, code.length, PROT_EXEC | PROT_READ) === 0)
    return address
  }
}

function addr (u32) {
  return u32[0] + ((2 ** 32) * u32[1])  
}

const handle = new Uint32Array(2)
const dlsym = wrap(handle, ffast.dlsym, 2)
const dlopen = wrap(handle, ffast.dlopen, 2)
const memcpy = wrap(handle, ffast.memcpy, 3)
const get_address = wrap(handle, ffast.get_address, 1)
const mmap = wrap(handle, ffast.mmap, 6)
const {
  mprotect, munmap, bind_fastcall,
  bind_slowcall, wrap_memory, unwrap_memory,
  PROT_READ, PROT_WRITE, PROT_EXEC, MAP_PRIVATE, MAP_ANONYMOUS,
  RTLD_LAZY, RTLD_LOCAL, RTLD_NOLOAD, RTLD_DEFAULT, RTLD_NEXT, RTLD_NOW,
  RTLD_GLOBAL,
  struct_fastcall_size, register_callback, get_callback_address,
  utf8_decode, latin1_decode, strnlen,
  read_memory, utf8_length, aligned_alloc, madvise
} = ffast
const fastcall_pointer_off = 0
const slowcall_pointer_off = 40 + (32 * 8)
const return_type_off = 8
const param_length_off = 9
const param_types_off = 10
const max_args = 30
const asm = new Assembler()
const compiler = new Compiler()
const encoder = new TextEncoder()

function cstr (str) {
  const buf = ptr(encoder.encode(`${str}\0`))
  buf.size = buf.size - 1
  return buf
}

export {
  dlopen, dlsym, memcpy, mmap, wrap, assert, ptr,
  mprotect, munmap, bind_fastcall,
  bind_slowcall, get_address, wrap_memory, unwrap_memory,
  PROT_READ, PROT_WRITE, PROT_EXEC, MAP_PRIVATE, MAP_ANONYMOUS,
  RTLD_LAZY, RTLD_LOCAL, RTLD_NOLOAD, RTLD_DEFAULT, RTLD_NEXT, RTLD_NOW,
  RTLD_GLOBAL,
  struct_fastcall_size, bind_custom, bind, register_callback,
  get_callback_address, Assembler, Registers, Compiler,
  asm, compiler, addr, colors, cstr,
  utf8_decode, latin1_decode, strnlen, read_memory, utf8_length, bindall,
  aligned_alloc, madvise
}
