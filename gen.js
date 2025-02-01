import { gen_source, gen_gyp } from './lib/gen.js'
import { readFileSync, writeFileSync } from 'node:fs'

const [ name ]  = process.argv.slice(2)
const config = await import (`./bindings/${name}.config.js`)
writeFileSync(`src/${name}.cc`, gen_source(config))
const target = gen_gyp(config)
let bindings = { targets: [] }
try {
  bindings = JSON.parse(readFileSync('binding.gyp'))
} catch (err) {}
const found = bindings.targets.some(t => {
  if (t.target_name === name) {
    Object.assign(t, target)
    return true
  }
  return false
})
if (!found) bindings.targets.push(target)
writeFileSync('binding.gyp', JSON.stringify(bindings, null, '  '))
console.log(`${name} bindings generated in src/${name}.cc`)