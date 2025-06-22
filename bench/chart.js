import { colors } from './bench.js'
import { readFileSync } from 'node:fs'

const { AM, AY, AG, AD } = colors

function uniq (arr) {
  return Object.keys(arr.reduce((p, c) => {
    p[c] = c
    return p
  }, {}))
}

function sort_ascending (a, b) {
  return a[1] - b[1]
}

function sort_descending (a, b) {
  return b[1] - a[1]
}

const Directions = {
  Ascending: 0,
  Descending: 1
}

function get_dot (pc, direction = Directions.Ascending) {
  if (direction === Directions.Ascending) {
    if (pc <= 1.1) return dots[0]
    if (pc <= 2.0) return dots[1]
    if (pc <= 5.0) return dots[2]
    return dots[3]
  } else {
    if (pc >= 0.99) return dots[0]
    if (pc >= 0.75) return dots[1]
    if (pc >= 0.40) return dots[2]
    return dots[3]
  }
}

function showChart (name, direction = Directions.Ascending) {
  const results = Object.keys(summary).map(k => [k, summary[k][name]])  
  let best = 0
  let max = 0
  if (direction === Directions.Ascending) {
    best = Math.min(...results.map(v => v[1]))
    max = Math.max(...results.map(v => v[1]))
    results.sort(sort_ascending)
  } else {
    best = Math.max(...results.map(v => v[1]))
    max = best
    results.sort(sort_descending)
  }
  console.log('')
  console.log(`${AY}${'name'.padEnd(32, ' ')}${AD} | ${AY}${name.padStart(16, ' ')}${AD} | ${AY}${''.padStart(8, ' ')}${AD} |`)
  console.log('-'.repeat(64))
  for (const result of results) {
    const [name, value] = result
    const blocks = Math.ceil((value / max) * 50)
    const pc = direction === Directions.Descending ? ((best / value)) : ((value / best))
    const dot = get_dot(value / best, direction)
    const display_val = value.toFixed(value >= 1000 ? 0 : 2)
    console.log(`${AM}${name.slice(0, 32).padEnd(32, ' ')}${AD} | ${AD}${display_val.padStart(16, ' ')}${AD} | ${AG}${pc.toFixed(2).padStart(8, ' ')}${AD} | ${(new Array(blocks)).fill(dot).join('')}`)
  }
  console.log('')
}

const dots = ['🟢', '🟡', '🟠', '🔴']
const summary = {}

const results = readFileSync('bench.log', 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l)
  .map(l => l.match(/([\w\d\.]+)\s+([\w\_\-]+)\s+time\s+(\d+)\s+rate\s+(\d+)\s+rate\/core\s+(\d+)\s+ns\/iter\s+([\d\.]+)\s+rss\s+(\d+)\s+usr\s+([\d\.]+)\s+sys\s+([\d\.]+)\s+tot\s+([\d\.]+)/))
  .filter(m => m)
  .map(matches => {
    const [ runtime, benchmark, time, rate, rate_per_core, ns_iter, rss, usr, sys, tot ] = Array.from(matches).slice(1).map((v, i) => i < 2 ? v : Number(v))
    return { name: `${runtime}.${benchmark}`, runtime, benchmark, time, rate, rate_per_core, ns_iter, rss, usr, sys, tot }
  })

uniq(results.map(result => `${result.runtime}.${result.benchmark}`)).forEach(name => {
  const b = summary[name] = {
    rate: 0, rate_per_core: 0, ns_iter: Infinity, rss: 0
  }
  for (const result of results.filter(r => r.name === name)) {
    const { rate, rate_per_core, ns_iter, rss } = result
    if (rate > b.rate) b.rate = rate
    if (rate_per_core > b.rate_per_core) b.rate_per_core = rate_per_core
    if (ns_iter < b.ns_iter) b.ns_iter = ns_iter
    if (rss > b.rss) b.rss = rss
  }
})

showChart('rate', Directions.Descending)
showChart('rate_per_core', Directions.Descending)
showChart('ns_iter', Directions.Ascending)
showChart('rss', Directions.Ascending)
