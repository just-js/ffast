import { createRequire } from "node:module"
import { 
  assert, wrap, utf8_decode, utf8_length, read_memory, colors, addr, wrap_memory,
  strnlen
} from './ffast.js'

const jscdb2 = createRequire(import.meta.url)('../build/Release/jscdb2.node')
const { 
  cdb2_open, cdb2_run_statement, cdb2_close, cdb2_next_record, cdb2_column_type, 
  cdb2_numcolumns, cdb2_column_value_as_integer, cdb2_errstr, cdb2_init_ssl,
  cdb2_is_ssl_encrypted
} = jscdb2

// column types
const CDB2__COLUMN_TYPE__INTEGER = 1
const CDB2__COLUMN_TYPE__REAL = 2
const CDB2__COLUMN_TYPE__CSTRING = 3
const CDB2__COLUMN_TYPE__BLOB = 4
const CDB2__COLUMN_TYPE__DATETIME = 6
const CDB2__COLUMN_TYPE__INTERVALYM = 7
const CDB2__COLUMN_TYPE__INTERVALDS = 8
const CDB2__COLUMN_TYPE__DATETIMEUS = 9
const CDB2__COLUMN_TYPE__INTERVALDSUS = 10
// database handle flags
const CDB2_READ_INTRANS_RESULTS = 2
const CDB2_DIRECT_CPU = 4
const CDB2_RANDOM = 8
const CDB2_RANDOMROOM = 16
const CDB2_ROOM = 32
const CDB2_ADMIN = 64
const CDB2_SQL_ROWS = 128
const CDB2_TYPE_IS_FD = 256
const CDB2_REQUIRE_FASTSQL = 512
const CDB2_MASTER = 1024
const default_flags = CDB2_DIRECT_CPU | CDB2_MASTER
// request types
const CDB2_REQUEST_CDB2QUERY = 1
const CDB2_REQUEST_SQLQUERY = 2
const CDB2_REQUEST_DBINFO = 3
// errors
const CDB2_OK = 0
const CDB2_OK_DONE = 1
const CDB2ERR_CONNECT_ERROR = -1
const CDB2ERR_NOTCONNECTED = -2
const CDB2ERR_PREPARE_ERROR = -3

const MAX_STRING = 4096

class Database {
  #name = ''
  #hostname = ''
  #flags = 0
  #db = 0

  constructor (name = '', hostname = 'localhost', flags = default_flags) {
    this.#name = name
    this.#hostname = hostname
    this.#flags = flags
  }

  connect () {
    const handle = new Uint32Array(2)
    assert(cdb2_open(handle, this.#name, this.#hostname, this.#flags) === CDB2_OK)
    this.#db = addr(handle)
  }

  exec (sql) {
    const db = this.#db
    let rc = cdb2_run_statement(db, `${sql}\0`)
    const rows = []
    assert(rc === CDB2_OK)
    while((rc = cdb2_next_record(db)) === CDB2_OK) {
      const cols = cdb2_numcolumns(db)
      const row = []
      for (let i = 0; i < cols; i++) {
        const type = cdb2_column_type(db, i)
        if (type === CDB2__COLUMN_TYPE__INTEGER) {
          row[i] = cdb2_column_value_as_integer(db, i)
        }
      }
      rows.push(row)
    }
    assert(rc === CDB2_OK_DONE)
    return rows
  }

  get error () {
    const handle = new Uint32Array(2)
    cdb2_errstr(this.#db, handle)
    const ptr = addr(handle)
    if (!ptr) return ''
    return utf8_decode(ptr, strnlen(ptr, MAX_STRING))
  }

  get encrypted () {
    return cdb2_is_ssl_encrypted(this.#db)
  }

  close () {
    assert(cdb2_close(this.#db) === CDB2_OK)
  }
}

//assert(cdb2_init_ssl(1, 1) === 0)

export { Database }
