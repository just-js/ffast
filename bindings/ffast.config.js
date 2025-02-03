const api = {
  dlopen: {
    parameters: ['string', 'i32'],
    pointers: ['const char*'],
    result: 'pointer',
  },
  dlsym: {
    parameters: ['pointer', 'string'],
    pointers: ['void*', 'const char*'],
    result: 'pointer',
  },
  mprotect: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'i32',
  },
  memcpy: {
    parameters: ['pointer', 'pointer', 'u32'],
    result: 'pointer',
  },
  mmap: {
    parameters: ['pointer', 'u32', 'i32', 'i32', 'i32', 'u32'],
    result: 'pointer',
  },
  munmap: {
    parameters: ['pointer', 'u32'],
    result: 'i32',
  },
  bind_fastcall: {
    declare_only: true,
    nofast: true
  },
  bind_slowcall: {
    declare_only: true,
    nofast: true
  },
  register_callback: {
    declare_only: true,
    nofast: true
  },
  get_address: {
    parameters: ['buffer'],
    declare_only: true,
  },
  get_callback_address: {
    declare_only: true,
    nofast: true
  },
  wrap_memory: {
    parameters: ['pointer', 'u32', 'i32'],
    result: 'pointer',
    declare_only: true,
    nofast: true
  },
  unwrap_memory: {
    parameters: ['buffer'],
    declare_only: true,
    nofast: true
  },
  utf8_length: {
    result: 'i32',
    parameters: ['string'],
    declare_only: true,
  },
  utf8_decode: {
    parameters: ['pointer', 'i32'],
    declare_only: true,
    nofast: true
  },
  latin1_decode: {
    parameters: ['pointer', 'i32'],
    declare_only: true,
    nofast: true
  },
  strnlen: {
    parameters: ['pointer', 'u32'],
    pointers: ['const char*'],
    result: 'u32'
  },
  read_memory: {
    result: 'void',
    parameters: ['buffer', 'pointer', 'u32'],
    declare_only: true,
  },
}

const constants = {
  PROT_READ: 'i32', 
  MAP_PRIVATE: 'i32', 
  PROT_WRITE: 'i32', 
  PROT_EXEC: 'i32', 
  MAP_ANONYMOUS: 'i32',
  struct_fastcall_size: 'u32',
  RTLD_LAZY: 'i32',
  RTLD_LOCAL: 'i32',
  RTLD_NOLOAD: 'i32',
  RTLD_NOW: 'i32',
  RTLD_GLOBAL: 'i32',
  RTLD_DEFAULT: 'u64',
  RTLD_NEXT: 'u64',
}

const name = 'ffast'
const includes = ['<sys/mman.h>', '<dlfcn.h>']

const preamble = `
using v8::HandleScope;
using v8::Uint8Array;
using v8::Uint32Array;
using v8::ObjectTemplate;
using v8::TypedArray;
using v8::Global;
using v8::BigInt;
using v8::MaybeLocal;
using v8::TryCatch;

enum FastTypes: int {
  i8 = 1, i16 = 2, i32 = 3, u8 = 4, u16 = 5, u32 = 6, empty = 7, f32 = 8,
  f64 = 9, u64 = 10, i64 = 11, iSize = 12, uSize = 13, pointer = 14,
  buffer = 15, function = 16, u32array = 17, boolean = 18, string = 19
};

struct fastcall {
  void* wrapper;      // 0-7   :   v8 fastcall wrapper function pointer
  uint8_t result;     // 8     :   the type of the result
  uint8_t nparam;     // 9     :   the number of args (max 255) 
  uint8_t param[30];  // 10-39 :   an array of types of the arguments
  uint64_t args[32];  // 40-295:   an array of pointer slots for arguments
                      // these will be filled in dynamically by 
                      // lo::core::SlowCallback for the slow call
                      // and then the slowcall wrapper will shift them from
                      // this structure into regs + stack and make the call
                      // the first slot is reserved for the result
  void* fn;           // 296-303:  the slowcall wrapper function pointer
  uint8_t padding[80]; // 304-383 :   an array of types of the arguments
};

int struct_fastcall_size = sizeof(struct fastcall);
typedef void (*lo_fast_call)(void*);

struct exec_info {
  v8::Global<v8::Function> js_fn;
  v8::Isolate* isolate;
  uint64_t rv;
  int nargs;
};

int callbacks = 0;

void lo_callback (exec_info* info) {
  Isolate* isolate = info->isolate;
//  HandleScope scope(isolate);
  info->js_fn.Get(isolate)->Call(isolate->GetCurrentContext(), 
    v8::Null(isolate), 0, 0).ToLocalChecked();
}

inline uint8_t needsunwrap (FastTypes t) {
  if (t == FastTypes::buffer) return 1;
  if (t == FastTypes::u32array) return 1;
  if (t == FastTypes::pointer) return 1;
  if (t == FastTypes::u64) return 1;
  if (t == FastTypes::i64) return 1;
  return 0;
}

void FreeMemory(void* buf, size_t length, void* data) {
  free(buf);
}

CTypeInfo* CTypeFromV8 (uint8_t v8Type) {
  if (v8Type == FastTypes::boolean)
    return new CTypeInfo(CTypeInfo::Type::kBool);
  if (v8Type == FastTypes::i8)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::i16)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::i32)
    return new CTypeInfo(CTypeInfo::Type::kInt32);
  if (v8Type == FastTypes::u8)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::u16)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::u32)
    return new CTypeInfo(CTypeInfo::Type::kUint32);
  if (v8Type == FastTypes::f32)
    return new CTypeInfo(CTypeInfo::Type::kFloat32);
  if (v8Type == FastTypes::f64)
    return new CTypeInfo(CTypeInfo::Type::kFloat64);
  if (v8Type == FastTypes::i64)
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == FastTypes::u64)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::iSize)
    return new CTypeInfo(CTypeInfo::Type::kInt64);
  if (v8Type == FastTypes::uSize)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::pointer)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::function)
    return new CTypeInfo(CTypeInfo::Type::kUint64);
  if (v8Type == FastTypes::string)
    return new CTypeInfo(CTypeInfo::Type::kSeqOneByteString);
  if (v8Type == FastTypes::buffer) {
    return new CTypeInfo(CTypeInfo::Type::kUint8,
      CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  }
  if (v8Type == FastTypes::u32array) {
    return new CTypeInfo(CTypeInfo::Type::kUint32,
      CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone);
  }
  return new CTypeInfo(CTypeInfo::Type::kVoid);
}

void lo_fastcall (struct fastcall* state) {
  ((lo_fast_call)state->fn)(&state->args);
}

void SlowCallback(const FunctionCallbackInfo<Value> &args) {
  struct fastcall* state = (struct fastcall*)Local<Integer>::Cast(args.Data())->Value();
  if (state->nparam == 0 && state->result == FastTypes::empty) {
    lo_fastcall(state);
    return;
  }
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);
  int r = 1;
  int s = 0;
  char* temp_strs[100];
  for (int i = 0; i < state->nparam; i++) {
    switch (state->param[i]) {
      case FastTypes::string:
        {
          String::Utf8Value arg0(isolate, args[i]);
          temp_strs[s] = strdup(*arg0);
          state->args[r++] = (uint64_t)temp_strs[s++];
        }
        break;
      case FastTypes::u32:
        state->args[r++] = (uint32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u16:
        state->args[r++] = (uint16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::u8:
        state->args[r++] = (uint8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::boolean:
        state->args[r++] = (bool)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i32:
        state->args[r++] = (int32_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i16:
        state->args[r++] = (int16_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i8:
        state->args[r++] = (int8_t)Local<Integer>::Cast(args[i])->Value();
        break;
      case FastTypes::i64:
      case FastTypes::iSize:
        state->args[r++] = (int64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::u64:
      case FastTypes::pointer:
      case FastTypes::uSize:
        state->args[r++] = (uint64_t)Local<Number>::Cast(args[i])->Value();
        break;
      case FastTypes::buffer:
        {
          Local<Uint8Array> u8 = args[i].As<Uint8Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u8->Buffer()->Data() +
            u8->ByteOffset());
        }
        break;
      case FastTypes::u32array:
        {
          Local<Uint32Array> u32 = args[i].As<Uint32Array>();
          state->args[r++] = (uint64_t)((uint8_t*)u32->Buffer()->Data() +
            u32->ByteOffset());
        }
        break;
      case FastTypes::function:
        break;
      case FastTypes::f32:
        {
          float src = (float)args[i].As<v8::Number>()->Value();
          float* dst = (float*)&state->args[r++];
          *dst = src;
        }
        break;
      case FastTypes::f64:
        {
          double src = (double)args[i].As<v8::Number>()->Value();
          double* dst = (double*)&state->args[r++];
          *dst = src;
        }
        break;
    }
  }
  lo_fastcall(state);
  for (int i = 0; i < s; i++) {
    free(temp_strs[i]);
  }
  switch (state->result) {
    case FastTypes::i32:
      args.GetReturnValue().Set((int32_t)state->args[0]);
      break;
    case FastTypes::u32:
      args.GetReturnValue().Set((uint32_t)state->args[0]);
      break;
    case FastTypes::boolean:
      args.GetReturnValue().Set((bool)state->args[0]);
      break;
    case FastTypes::f32:
      {
        float* dst = (float*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::f64:
      {
        double* dst = (double*)&state->args[0];
        args.GetReturnValue().Set(Number::New(isolate, *dst));
      }
      break;
    case FastTypes::i64:
      {
        int64_t* res = (int64_t*)args[args.Length() - 1]
          .As<Uint32Array>()->Buffer()->Data();
        *res = state->args[0];
      }
      break;
    case FastTypes::buffer:
    case FastTypes::u32array:
    case FastTypes::u64:
    case FastTypes::pointer:
      {
        uint64_t* res = (uint64_t*)args[args.Length() - 1]
          .As<Uint32Array>()->Buffer()->Data();
        *res = state->args[0];
      }
      break;
  }
}

void get_addressSlow(const FunctionCallbackInfo<Value> &args) {
  Local<TypedArray> ta = args[0].As<TypedArray>();
  uint8_t* ptr = (uint8_t*)ta->Buffer()->Data() + ta->ByteOffset();
  ((uint64_t*)args[1].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)ptr;
}

void get_addressFast(void* p, struct FastApiArrayBufferView* const p_buf, 
  struct FastApiArrayBufferView* const p_ret) {
  ((uint64_t*)p_ret->data)[0] = (uint64_t)p_buf->data;
}

void get_callback_addressSlow(const FunctionCallbackInfo<Value> &args) {
  ((uint64_t*)args[0].As<Uint32Array>()->Buffer()->Data())[0] = (uint64_t)&lo_callback;
}

void bind_fastcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<Number> data = Number::New(isolate, (uint64_t)state);
  uint8_t unwrap = needsunwrap((FastTypes)state->result);
  int fastlen = state->nparam + 1 + unwrap;
  CTypeInfo* cargs = (CTypeInfo*)calloc(fastlen, sizeof(CTypeInfo));
  cargs[0] = CTypeInfo(CTypeInfo::Type::kV8Value);
  for (int i = 0; i < state->nparam; i++) {
    uint8_t ptype = state->param[i];
    cargs[i + 1] = *CTypeFromV8(ptype);
  }
  CTypeInfo* rc;
  if (unwrap) {
    cargs[fastlen - 1] = *CTypeFromV8(FastTypes::u32array);
    rc = CTypeFromV8(FastTypes::empty);
  } else {
    rc = CTypeFromV8((FastTypes)state->result);
  }
  CFunctionInfo* info = new CFunctionInfo(*rc, fastlen, cargs);
  CFunction* fastCFunc = new CFunction(state->wrapper, info);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, fastCFunc
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

void bind_slowcallSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  Local<Context> context = isolate->GetCurrentContext();
  struct fastcall* state = reinterpret_cast<struct fastcall*>(
    Local<Integer>::Cast(args[0])->Value());
  Local<Number> data = Number::New(isolate, (uint64_t)state);
  Local<FunctionTemplate> funcTemplate = FunctionTemplate::New(isolate,
    SlowCallback, data, Local<Signature>(), 0, ConstructorBehavior::kThrow,
    SideEffectType::kHasNoSideEffect, 0
  );
  Local<Function> fun =
    funcTemplate->GetFunction(context).ToLocalChecked();
  args.GetReturnValue().Set(fun);
}

void wrap_memorySlow(const FunctionCallbackInfo<Value> &args) {
  Isolate* isolate = args.GetIsolate();
  uint64_t start64 = (uint64_t)Local<Number>::Cast(args[0])->Value();
  uint32_t size = (uint32_t)Local<Integer>::Cast(args[1])->Value();
  void* start = reinterpret_cast<void*>(start64);
  int32_t free_memory = 0;
  if (args.Length() > 2) {
    free_memory = (int32_t)Local<Integer>::Cast(args[2])->Value();
  }
  if (free_memory == 0) {
    std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
        start, size, [](void*, size_t, void*){}, nullptr);
    Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
    args.GetReturnValue().Set(ab);
    return;
  }
  std::unique_ptr<BackingStore> backing = ArrayBuffer::NewBackingStore(
      start, size, FreeMemory, nullptr);
  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, std::move(backing));
  args.GetReturnValue().Set(ab);
}

void unwrap_memorySlow(const FunctionCallbackInfo<Value> &args) {
  Local<ArrayBuffer> ab = args[0].As<ArrayBuffer>();
  ab->Detach(v8::Null(args.GetIsolate())).Check();
}

void utf8_lengthSlow(const FunctionCallbackInfo<Value> &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(args[0].As<String>()->Utf8Length(isolate));
}

int32_t utf8_lengthFast (void* p, struct FastOneByteString* const p_str) {
  return p_str->length;
}

void register_callbackSlow(const FunctionCallbackInfo<Value>& args) {
  struct exec_info* info = reinterpret_cast<struct exec_info*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  Local<Function> fn = args[1].As<Function>();
  int nargs = Local<Integer>::Cast(args[2])->Value();
  Isolate* isolate = args.GetIsolate();
  info->isolate = isolate;
  info->nargs = nargs;
  info->js_fn.Reset(isolate, Global<Function>(isolate, fn));
}

void utf8_decodeSlow(const FunctionCallbackInfo<Value> &args) {
  int size = -1;
  if (args.Length() > 1) {
    size = Local<Integer>::Cast(args[1])->Value();
  }
  char* str = reinterpret_cast<char*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromUtf8(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}

void latin1_decodeSlow(const FunctionCallbackInfo<Value> &args) {
  int size = -1;
  if (args.Length() > 1) {
    size = Local<Integer>::Cast(args[1])->Value();
  }
  uint8_t* str = reinterpret_cast<uint8_t*>(
    (uint64_t)Local<Integer>::Cast(args[0])->Value());
  args.GetReturnValue().Set(String::NewFromOneByte(args.GetIsolate(), 
    str, NewStringType::kNormal, size).ToLocalChecked());
}

void read_memorySlow(const FunctionCallbackInfo<Value> &args) {
  Local<Uint8Array> u8 = args[0].As<Uint8Array>();
  uint8_t* dest = (uint8_t*)u8->Buffer()->Data() + u8->ByteOffset();
  void* start = reinterpret_cast<void*>(
    (uint64_t)Local<Integer>::Cast(args[1])->Value());
  uint32_t size = Local<Integer>::Cast(args[2])->Value();
  memcpy(dest, start, size);
}

void read_memoryFast(void* p, struct FastApiArrayBufferView* const p_buf, 
  void* start, uint32_t size) {
  memcpy(p_buf->data, start, size);
}
`

export { api, name, constants, includes, preamble }
