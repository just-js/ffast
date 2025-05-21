import { createRequire } from "node:module"
import { 
  assert, wrap, utf8_decode, utf8_length, read_memory, colors, addr, wrap_memory,
  strnlen
} from './ffast.js'

const sqlite = createRequire(import.meta.url)('../build/Release/sqlite.node')

const {
  step, column_int, column_double, reset, finalize,
  open2, exec, close2, prepare2, column_count,
  column_type, column_bytes, bind_int, bind_int64,
  bind_double, bind_text, bind_blob,
  SQLITE_OPEN_READWRITE, SQLITE_OPEN_PRIVATECACHE, SQLITE_ROW, SQLITE_OPEN_NOMUTEX,
  SQLITE_OPEN_CREATE, SQLITE_OK, SQLITE_OPEN_READONLY, SQLITE_DONE,
} = sqlite

const { AY, AD } = colors

const u32 = new Uint32Array(2)
const errmsg = wrap(u32, sqlite.errmsg, 1)
const column_name = wrap(u32, sqlite.column_name, 2)
const column_text = wrap(u32, sqlite.column_text, 2)

const column_blob = wrap(u32, sqlite.column_blob, 2)
const _serialize = wrap(u32, sqlite.serialize, 4)

function sqlite_error (db) {
  return `${AY}SQLite${AD} ${utf8_decode(errmsg(db), -1)}`
}

const BLOB_WRITABLE = 1
const BLOB_READONLY = 0
const OK = SQLITE_OK
const ROW = SQLITE_ROW
const DONE = SQLITE_DONE
const OPEN_CREATE = SQLITE_OPEN_CREATE
const OPEN_READWRITE = SQLITE_OPEN_READWRITE
const OPEN_NOMUTEX = SQLITE_OPEN_NOMUTEX

class Database {
  open (path, flags = OPEN_CREATE | OPEN_READWRITE | OPEN_NOMUTEX) {
    assert(open2(path, u32, flags, 0) === OK)
    this.db = assert(addr(u32))
    return this
  }

  error () {
    return sqlite_error(this.db)
  }

  exec (sql) {
    assert(exec(this.db, sql, 0, 0, u32) === OK)
    return this
  }

  prepare (sql) {
    return (new Statement(this.db)).prepare(sql)
  }

  readableBlob (table, col, row, database = 'main') {
    return new Blob(this.db).open(table, col, row, BLOB_READONLY, database)
  }

  writableBlob (table, col, row, database = 'main') {
    return new Blob(this.db).open(table, col, row, BLOB_WRITABLE, database)
  }

  close () {
    assert(close2(this.db) === OK)
  }

  serialize (name = 'main') {
    const sz = new Uint32Array(2)
    const address = _serialize(this.db, name, sz, 0)
    return new Uint8Array(wrap_memory(address, addr(sz), 1))
  }
}

class Blob {
  #handle = 0
  #db = 0

  constructor (db) {
    this.#db = db
  }

  open (table, col, row, flags = BLOB_WRITABLE, database = 'main') {
    assert(sqlite.blob_open(this.#db, database, table, col, row, flags, u32) === 0)
    this.#handle = assert(addr(u32))
    return this
  }

  read (u8, size = u8.length) {
    assert(sqlite.blob_read(this.#handle, u8, size, 0) === 0)
  }

  write (u8, size = u8.length) {
    assert(sqlite.blob_write(this.#handle, u8, size, 0) === 0)
  }

  bytes () {
    return sqlite.blob_bytes(this.#handle)
  }

  close () {
    assert(sqlite.blob_close(this.#handle) === 0)
    this.#handle = 0
  }
}

class Statement {
  types = []
  names = []
  columns = 0
  maxRows = 1 * 1024 * 1024
  count = 0

  constructor (db) {
    this.db = db
  }

  error () {
    return sqlite_error(this.db)
  }

  prepare (sql) {
    assert(prepare2(this.db, sql, utf8_length(sql), u32, 0) === OK, () => this.error())
    this.stmt = assert(addr(u32))
    return this
  }

  step () {
    if (this.columns === 0) {
      const { stmt } = this
      const rc = step(stmt)
      if (rc === ROW) {
        this.columns = column_count(stmt)
        for (let i = 0; i < this.columns; i++) {
          this.names.push(utf8_decode(column_name(stmt, i), -1))
          this.types.push(column_type(stmt, i))
        }
      }
      return rc
    }
    return step(this.stmt)
  }

  bindInt (index = 0, i) {
    return bind_int(this.stmt, index, i)
  }

  bindInt64 (index = 0, i) {
    return bind_int64(this.stmt, index, i)
  }

  bindDouble (index = 0, i) {
    return bind_double(this.stmt, index, i)
  }

  bindText (index = 0, str) {
    return bind_text(this.stmt, index, str, utf8_length(str), -1)
  }

  bindBlob (index = 0, u8) {
    return bind_blob(this.stmt, index, u8, u8.length, 0)
  }

  columnInt (index = 0) {
    return column_int(this.stmt, index)
  }

  columnBytes (index = 0) {
    return column_bytes(this.stmt, index)
  }

  columnDouble (index = 0) {
    return column_double(this.stmt, index)
  }

  columnText (index = 0) {
    const ptr = column_text(this.stmt, index)
    if (!ptr) return ''
    const size = column_bytes(this.stmt, index)
    return utf8_decode(ptr, size)
  }

  columnBlobInto (index = 0, u8) {
    const ptr = column_blob(this.stmt, index)
    if (!ptr) return 0
    const size = column_bytes(this.stmt, index)
    if (size === 0) return size
    read_memory(u8, ptr, size)
    return size
  }

  columnBlob (index = 0) {
    const ptr = column_blob(this.stmt, index)
    if (!ptr) return null
    const size = column_bytes(this.stmt, index)
    const u8 = new Uint8Array(size)
    read_memory(u8, ptr, size)
    return u8
  }

  reset () {
    return reset(this.stmt)
  }

  finalize () {
    return finalize(this.stmt)
  }

  get () {
    const { types, names, stmt } = this
    if(this.step() === ROW) {
      const { columns } = this
      const row = {}
      for (let i = 0; i < columns; i++) {
        if (types[i] === 1) {
          row[names[i]] = column_int(stmt, i)
        } else if (types[i] === 2) {
          row[names[i]] = column_double(stmt, i)
        } else if (types[i] === 3) {
          row[names[i]] = this.columnText(i)
        } else if (types[i] === 4) {
          row[names[i]] = this.columnBlob(i)
        }
      }
      this.reset()
      return row
    }
  }

  all () {
    const rows = []
    const { stmt } = this
    let rc = step(stmt)
    //let rc = this.step()
    let count = 0
    if (!this.types.length) {
      this.columns = column_count(stmt)
      for (let i = 0; i < this.columns; i++) {
        this.names.push(utf8_decode(column_name(stmt, i), -1))
        this.types.push(column_type(stmt, i))
      }
    }
    const { columns, names, types } = this
    while (rc === ROW) {
      const row = {}
      for (let i = 0; i < columns; i++) {
        // todo: these could be indexes into a function table
//console.log(`column ${i} type ${types[i]}`)
        if (types[i] === 1) {
          row[names[i]] = column_int(stmt, i)
        } else if (types[i] === 2) {
          row[names[i]] = column_double(stmt, i)
        } else if (types[i] === 3) {
//          row[names[i]] = this.columnText(i)
          const h = new Uint32Array(2)
          const size = column_bytes(stmt, i)
          sqlite.column_text(stmt, i, h)
//          console.log(h)
          const p = addr(h)
          if (p) {
            row[names[i]] = utf8_decode(p, size)
          } else {
            row[names[i]] = null
          }
//          row[names[i]] = column_text(stmt, i)
//          row[names[i]] = ''
        } else if (types[i] === 4) {
          row[names[i]] = this.columnBlob(i)
        }
      }
//console.log(row)
      rows.push(row)
      count++
      rc = step(stmt)
    }
    assert(rc === OK || rc === DONE)
    this.count = count
    this.reset()
    return rows
  }

// todo - bindings
  compile (className = 'Row', fixed = false) {
    const { types, names, stmt } = this

    const rc = step(stmt)
    if (rc === ROW) {
      this.columns = column_count(stmt)
      for (let i = 0; i < this.columns; i++) {
        this.names.push(utf8_decode(column_name(stmt, i), -1))
        this.types.push(column_type(stmt, i))
      }
    }
    this.reset()

    const source = []
    let name
    let i = 0
    source.push(`class ${className} {`)
    for (const type of types) {
      name = names[i]
      if (type === 1) {
        source.push(`  ${name} = 0`)
      } else if (type === 2) {
        source.push(`  ${name} = 0.0`)
      } else if (type === 3) {
        source.push(`  ${name} = ''`)
      }
      i++
    }
    source.push('}')
    source.push(`return ${className}`)
    this.Row = (new Function(source.join('\n')))()
    source.length = 0
    source.push(`
const { types, names, cols, stmt } = this
const rows = []
let rc = sqlite.step(stmt)
let i = 0
while (rc === ${ROW}) {
`)
//    if (fixed) {
//      source.push('  const row = rows[i]')
//    } else {
//      source.push(`  const row = rows[i] = new ${className}()`)
//    }
      source.push(`  const row = new ${className}()`)
    i = 0
    for (const type of types) {
      if (type === 1) {
        source.push(`  row['${names[i]}'] = sqlite.column_int(stmt, ${i})`)
      // todo: why am i indexing into array here?
      } else if (types[i] === 2) {
        source.push(`  row['${names[i]}'] = sqlite.column_double(stmt, ${i})`)
      } else if (types[i] === 3) {
        // todo: use the direct methods
        source.push(`  row['${names[i]}'] = this.columnText(${i})`)
      } else if (types[i] === 4) {
        source.push(`  row['${names[i]}'] = this.columnBlob(${i})`)
      }
      i++
    }
    source.push(`
  rows.push(row)
  rc = sqlite.step(stmt)
  i++
}
this.count = i
sqlite.reset(stmt)
return rows
`)
    const allsrc = source.join('\n').split('\n').filter(l => l).join('\n')
    this.all = (new Function('sqlite', className, `return function () {\n${allsrc}\n}`))(sqlite, this.Row)
    source.length = 0
    source.push(`const { types, names, stmt } = this
    `)
//    if (fixed) {
//      source.push('const row = rows[0]')
//    } else {
//      source.push(`const row = rows[0] = new ${className}()`)
//    }
    source.push(`const row = new ${className}()`)
    source.push(`if (sqlite.step(stmt) === ${ROW}) {`)
    i = 0
    for (const type of types) {
      if (type === 1) {
        // todo: why not used dot notation?
        source.push(`  row['${names[i]}'] = sqlite.column_int(stmt, ${i})`)
      } else if (types[i] === 2) {
        source.push(`  row['${names[i]}'] = sqlite.column_double(stmt, ${i})`)
      } else if (types[i] === 3) {
        source.push(`  row['${names[i]}'] = this.columnText(${i})`)
      } else if (types[i] === 4) {
        source.push(`  row['${names[i]}'] = this.columnBlob(${i})`)
      }
      i++
    }
    source.push(`}
sqlite.reset(stmt)
return row
`)
    const getsrc = source.join('\n').split('\n').filter(l => l).join('\n')
    this.get = (new Function('sqlite', className, `return function () {\n${getsrc}\n}`))(sqlite, this.Row)
    return this
  }

}

sqlite.constants = { DONE, OK, ROW }

export { Database, Statement, sqlite }
