function get_type (t, rv = false) {
  if (t === 'i8') return 'int8_t'
  if (t === 'i16') return 'int16_t'
  if (t === 'i32') return 'int32_t'
  if (t === 'u8') return 'uint8_t'
  if (t === 'bool') return 'uint8_t'
  if (t === 'u16') return 'uint16_t'
  if (t === 'u32') return 'uint32_t'
  if (t === 'void') return 'void'
  if (t === 'f32') return 'float'
  if (t === 'f64') return 'double'
  if (t === 'i64') return 'int64_t'
  if (t === 'u64') return 'uint64_t'
  if (t === 'isz') return 'intptr_t'
  if (t === 'usz') return 'uintptr_t'
  if (t === 'string') return 'struct FastOneByteString* const'
  if (t === 'buffer') return 'struct FastApiArrayBufferView* const'
  if (t === 'u32array') return 'struct FastApiArrayBufferView* const'
  if (rv) return 'void'
  return 'void*'
}

function getFastType (id = '') {
  if (id === 'u8') return 'kUint8'
  if (id === 'bool') return 'kUint8'
  if (id === 'u32') return 'kUint32'
  if (id === 'i32') return 'kInt32'
  if (id === 'pointer') return 'kUint64'
  if (id === 'void') return 'kVoid'
  if (id === 'u64') return 'kUint64'
  if (id === 'i64') return 'kInt64'
  if (id === 'f32') return 'kFloat32'
  if (id === 'f64') return 'kFloat64'
  if (id === 'string') return 'kSeqOneByteString'
  if (id === 'buffer') return 'kUint8, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone'
  if (id === 'u32array') return 'kUint32, CTypeInfo::SequenceType::kIsTypedArray, CTypeInfo::Flags::kNone'
  return 'kVoid'
}

function needsUnwrap (t) {
  if (t === 'u8') return false
  if (t === 'bool') return false
  if (t === 'u32') return false
  if (t === 'i32') return false
  if (t === 'f32') return false
  if (t === 'void') return false
  return true
}

function gen_includes (config) {
  return ['"ffast.h"', ...(config.includes || [])].map(n => `#include ${n}`).join('\n')
}

function getParams (def) {
  let params = def.parameters.map((p, i) => `${get_type(p)} p${i}`).filter((p, i) => !(def.override && def.override[i]))
  if (needsUnwrap(def.result)) {
    params.push('struct FastApiArrayBufferView* const p_ret')
  }
  return params.join(', ')
}

function getFastParameterCast (parameter, index, pointers, override) {
  if (parameter === 'pointer') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index});`
  }
  if (parameter === 'string') {
    return `  struct FastOneByteString* const v${index} = p${index};`
  }
  if (parameter === 'buffer') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>(p${index}->data);`
  }
  if (override.length > index && override[index] !== undefined) {
    if (override[index].constructor.name === 'Object') {
      return `  ${get_type(parameter)} v${index} = p${override[index].param}${override[index].fastfield};`
    } else if (override[index].constructor.name === 'Number') {
      return `  ${get_type(parameter)} v${index} = ${override[index]};`
    } else if (override[index].constructor.name === 'String') {
      return `  ${get_type(parameter)} v${index} = "${override[index]}";`
    } else {
      throw new Error('unsupported override type')
    }
  } else {
    return `  ${get_type(parameter)} v${index} = p${index};`
  }
}

function gen_function (n, api) {
  const definition = api[n]
  const { declare_only, parameters, pointers = [], result, name = n, rpointer, nofast, casts = [], override = []} = definition
  function getCast (i) {
    return `${casts[i] ? casts[i]: ''}`
  }
  if (declare_only) return ''
  let src = `
void ${n}Slow(const FunctionCallbackInfo<Value> &args) {\n`
  if ((result === 'i64' || result === 'u64') || parameters.includes('string')) {
    src += `  Isolate *isolate = args.GetIsolate();\n`
  }
  src += `${parameters.map((p, i) => getSlowParameterCast(p, i, pointers, override)).join('\n')}\n`
  if (result === 'void') {
    src += `  ${name}(${parameters.map((p, i) => `${p === 'string' ? getCast(i) + '*' : getCast(i)}v${i}`).join(', ')});\n`
  } else {
    src += `  ${rpointer || get_type(result)} rc = ${name}(${parameters.map((p, i) => `${p === 'string' ? `${getCast(i)}*` : getCast(i)}v${i}`).join(', ')});\n`
  }
  if (needsUnwrap(result)) {
    if (result === 'pointer') {
      src += `  Local<ArrayBuffer> ab = args[${parameters.length - override.filter(v => v).length}].As<Uint32Array>()->Buffer();\n`
      src += `  ((${rpointer || get_type(result)}*)ab->Data())[0] = rc;\n`
    } else if (result === 'i64') {
      src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<int64_t>(rc)));\n`
    } else if (result === 'u64') {
      src += `  args.GetReturnValue().Set(Number::New(isolate, static_cast<uint64_t>(rc)));\n`
    }
  } else if (result !== 'void') {
    src += `  args.GetReturnValue().Set(rc);\n`
  }
  src += `}\n`
  if (nofast) return src
  src += `
${needsUnwrap(definition.result) ? 'void' : get_type(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)}) {
${parameters.map((p, i) => getFastParameterCast(p, i, pointers, override)).join('\n')}`
  if (result === 'void') {
    src += `\n  ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});`
  } else if (needsUnwrap(result)) {
    src += `\n  ${rpointer || get_type(result)} r = ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});\n`
    src += `  ((${rpointer || get_type(result)}*)p_ret->data)[0] = r;\n`
  } else {
    src += `\n  return ${name}(${parameters.map((p, i) => `${getCast(i)}v${i}${p === 'string' ? '->data' : ''}`).join(', ')});`
  }
  src += '\n}'
  return src
}

function getParameterInit(p, i, name) {
  return `  v8::CTypeInfo(v8::CTypeInfo::Type::${getFastType(p)}),`
}

function getFastFunctionDecl (n, api) {
  const definition = api[n]
  const { result, name = n, nofast, override } = definition
  if (nofast) {
    return ''
  }
  let parameters = definition.parameters.slice(0)
  if (override && override.length && override.length >= parameters.length) {
    const overrides_len = override.filter(v => v).length
    parameters = parameters.slice(0, parameters.length - overrides_len)
  }
  if (needsUnwrap(result)) {
    let src = `\nvoid ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
    src += `\nv8::CTypeInfo cargs${n}[${parameters.length + 2}] = {\n`
    src += `  v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value),\n`
    src += `${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}\n`
    src += `  v8::CTypeInfo(v8::CTypeInfo::Type::kUint32, v8::CTypeInfo::SequenceType::kIsTypedArray, v8::CTypeInfo::Flags::kNone)\n`
    src += '};\n'
    src += `v8::CTypeInfo rc${n} = v8::CTypeInfo(v8::CTypeInfo::Type::kVoid);
v8::CFunctionInfo info${n} = v8::CFunctionInfo(rc${n}, ${parameters.length + 2}, cargs${n});
v8::CFunction pF${n} = v8::CFunction((const void*)&${n}Fast, &info${n});\n`
    return src;
  }
  let src = `\n${get_type(result, true)} ${n}Fast(void* p${(parameters.length || needsUnwrap(definition.result)) ? ', ' : ''}${getParams(definition)});`
  src += `\nv8::CTypeInfo cargs${n}[${parameters.length + 1}] = {
v8::CTypeInfo(v8::CTypeInfo::Type::kV8Value),
${parameters.map((p, i) => getParameterInit(p, i, n)).join('\n')}
};
v8::CTypeInfo rc${n} = v8::CTypeInfo(v8::CTypeInfo::Type::${getFastType(result)});
v8::CFunctionInfo info${n} = v8::CFunctionInfo(rc${n}, ${parameters.length + 1}, cargs${n});
v8::CFunction pF${n} = v8::CFunction((const void*)&${n}Fast, &info${n});\n`
  return src
}

function getSlowParameterCast (parameter, index, pointers, override) {
  if (parameter === 'pointer') {
    const pType = pointers[index] || 'void*'
    return `  ${pType} v${index} = reinterpret_cast<${pType}>((uint64_t)Local<Integer>::Cast(args[${index}])->Value());`
  }
  if (parameter === 'string') {
    return `  String::Utf8Value v${index}(isolate, args[${index}]);`
  }
  if (parameter === 'buffer') {
    const pType = pointers[index] || 'void*'
    return [
      `  Local<Uint8Array> u8${index} = args[${index}].As<Uint8Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u8${index}->Buffer()->Data() + u8${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
  }
  if (parameter === 'u32array') {
    const pType = pointers[index] || 'void*'
    return [
      `  Local<Uint32Array> u32${index} = args[${index}].As<Uint32Array>();`,
      `  uint8_t* ptr${index} = (uint8_t*)u32${index}->Buffer()->Data() + u32${index}->ByteOffset();`,
      `  ${pType} v${index} = reinterpret_cast<${pType}>(ptr${index});`
    ].join('\n')
  }
  if (override[index]) {
    return `  ${get_type(parameter)} v${index} = v${override[index].param}${override[index].slowfield};`
  } else {
    return `  ${get_type(parameter)} v${index} = Local<Integer>::Cast(args[${index}])->Value();`
  }
}

function gen_handlers (config) {
  const src = []
  for (const name of Object.keys(config.api || {})) {
    src.push(gen_function(name, config.api))
  }
  return src.join('\n')
}

function gen_fast_declarations (config) {
  const src = []
  for (const name of Object.keys(config.api || {})) {
    src.push(getFastFunctionDecl(name, config.api))
  }
  return src.join('\n')
}

function gen_initializers (config) {
  const src = []
  for (const name of Object.keys(config.api || {})) {
    const def = config.api[name]
    if (def.nofast) {
      src.push(`  NODE_SET_METHOD(exports, "${name}", ${name}Slow);`)
    } else {
      src.push(`  NODE_SET_FAST_METHOD(isolate, exports, "${name}", &pF${name}, ${name}Slow);`)
    }
  }
  return src.join('\n')
}

function initConstant(n, constants) {
  if (!constants) return ''
  if (!constants.hasOwnProperty(n)) return ''
  const type = constants[n]
  if (type === 'u32') {
    return `  NODE_SET_VALUE(isolate, exports, "${n}", Integer::New(isolate, (uint32_t)${n}));\n`
  }
  if (type ==='i32') {
    return `  NODE_SET_VALUE(isolate, exports, "${n}", Integer::New(isolate, (int32_t)${n}));\n`
  }
  if (type ==='u64') {
    return `  NODE_SET_VALUE(isolate, exports, "${n}", BigInt::New(isolate, (uint64_t)${n}));\n`
  }
  if (type ==='i64') {
    return `  NODE_SET_VALUE(isolate, exports, "${n}", BigInt::New(isolate, (int64_t)${n}));\n`
  }
  if (isNumeric(type)) {
    return `  NODE_SET_VALUE(isolate, exports, "${n}", Number::New(isolate, (int64_t)${type}));\n`
  }
  throw new Error('TODO')
}

// todo: fix this later to avoid iterating through these twice
function needs_isolate (config) {
  if (Object.keys(config.constants || {}).length) return true
  return Object.keys(config.api || {}).some(name => !config.api[name].hasOwnProperty('nofast'))
}

function gen_source (config) {
  const src = `
${gen_includes(config)}

namespace ${config.namespace || 'ffast'} {
${gen_fast_declarations(config)}
${config.preamble || ''}
${gen_handlers(config)}

void Initialize(Local<Object> exports) {
${needs_isolate(config) ? '  Isolate* isolate = Isolate::GetCurrent();' : ''}
${gen_initializers(config)}
${Object.keys(config.constants || {}).map(n => initConstant(n, config.constants)).join('')}
}

#pragma GCC diagnostic ignored "-Wcast-function-type"
NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
#pragma GCC diagnostic pop
}
`
  return src
}

function gen_gyp (config) {
  const { include_dirs, libraries, name } = config
  const target = {
    target_name: name,
    sources: [ `src/${name}.cc` ],
    cflags_cc: [ '-O3', '-march=native', '-mtune=native', '-Wcast-function-type' ],
    include_dirs,
    libraries
  }
  if (config.libs) {
    target.link_settings = {
      libraries: config.libs.map(l => `-l${l}`)
    }
  }
  return target
}

export { gen_source, gen_gyp }
