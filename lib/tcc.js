import { createRequire } from "node:module"
import { assert, wrap } from './ffast.js'

const tcc = createRequire(import.meta.url)('../build/Release/tcc.node')

const TCC_OUTPUT_MEMORY = 1
const TCC_RELOCATE_AUTO = 1

tcc.constants = {
  TCC_OUTPUT_MEMORY, TCC_RELOCATE_AUTO
}

const handle = new Uint32Array(2)
tcc.create = wrap(handle, tcc.create, 0)
tcc.get_symbol = wrap(handle, tcc.get_symbol, 2)

class Compiler {

  constructor () {
    this.compiler = tcc.create()
    assert(this.compiler)
  }

  compile (src, relocate = true) {
    assert(this.compiler)
    const { compiler } = this
    tcc.set_output_type(compiler, TCC_OUTPUT_MEMORY)
    let rc = tcc.compile_string(compiler, src)
    assert(rc === 0, `could not compile (${rc})`)
    if (relocate) this.relocate()
  }

  options (str) {
    assert(this.compiler)
    const { compiler } = this
    tcc.set_options(compiler, str)
  }

  libs (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_library(compiler, path) === 0)
  }

  paths (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_library_path(compiler, path) === 0)
  }

  files (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_file(compiler, path) === 0)
  }

  includes (path) {
    assert(this.compiler)
    const { compiler } = this
    assert(tcc.add_include_path(compiler, path) === 0)
  }

  relocate () {
    assert(this.compiler)
    const { compiler } = this
    const rc = tcc.relocate(compiler, TCC_RELOCATE_AUTO)
    assert(rc === 0, `could not relocate (${rc})`)
  }

  symbol (name) {
    assert(this.compiler)
    return tcc.get_symbol(this.compiler, name)
  }

  add (name, address) {
    assert(address)
    return tcc.add_symbol(this.compiler, name, address)
  }
}

export { Compiler, tcc }
