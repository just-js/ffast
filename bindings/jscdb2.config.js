const api = {
  cdb2_open: {
    parameters: ['u32array', 'string', 'string', 'i32'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp**'],
  },
  cdb2_run_statement: {
    parameters: ['pointer', 'string'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_next_record: {
    parameters: ['pointer'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_close: {
    parameters: ['pointer'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_column_value: {
    parameters: ['pointer', 'i32'],
    result: 'pointer',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_column_value_as_integer: {
    parameters: ['pointer', 'i32'],
    result: 'i64',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_column_name: {
    parameters: ['pointer', 'i32'],
    result: 'pointer',
    pointers: ['cdb2_hndl_tp*'],
    rpointer: 'const char*'
  },
  cdb2_errstr: {
    parameters: ['pointer'],
    result: 'pointer',
    pointers: ['cdb2_hndl_tp*'],
    rpointer: 'const char*'
  },
  cdb2_column_type: {
    parameters: ['pointer', 'i32'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_numcolumns: {
    parameters: ['pointer'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_is_ssl_encrypted: {
    parameters: ['pointer'],
    result: 'i32',
    pointers: ['cdb2_hndl_tp*'],
  },
  cdb2_init_ssl: {
    parameters: ['i32', 'i32'],
    result: 'i32',
  }
}

const preamble = `
  int64_t cdb2_column_value_as_integer (cdb2_hndl_tp* db, int col) {
    int64_t* val = (int64_t*)cdb2_column_value(db, col);
    return *val;
  }
`
const name = 'jscdb2'
const constants = {}
const includes = ['<cdb2api.h>', '<cdb2_constants.h>']
const include_dirs = ['/media/andrew/OCZ/source2023/just-js/comdb2/cdb2api', '/media/andrew/OCZ/source2023/just-js/comdb2/bbinc']
const structs = []
const obj = ['/media/andrew/OCZ/source2023/just-js/comdb2/build/cdb2api/libcdb2api.a']
const libraries = ['/media/andrew/OCZ/source2023/just-js/comdb2/build/cdb2api/libcdb2api.a']
const lib_paths = []

export { name, api, constants, includes, include_dirs, structs, obj, libraries, lib_paths, preamble }
