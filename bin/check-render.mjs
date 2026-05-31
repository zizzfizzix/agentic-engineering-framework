#!/usr/bin/env node
// check-render — the framework's own test gate (decision #9).
// Renders every shipped skill across an adapter matrix and asserts the invariants that keep
// the convergence model honest. Run before committing any framework change; improve-framework
// runs this before opening a PR.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSkill, SLOT_OPEN, SLOT_ANY } from './lib/render-skill.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ls = (p) => (existsSync(p) ? readdirSync(p) : [])

// All adapters per axis, discovered from disk.
const adaptersByAxis = {}
for (const axis of ['orm', 'ui', 'stack']) {
  adaptersByAxis[axis] = ls(join(ROOT, 'adapters', axis)).filter((n) =>
    existsSync(join(ROOT, 'adapters', axis, n, 'adapter.json')))
}

// Selection matrix: none, each single adapter, and a couple of full combos.
const matrix = [
  {},
  { orm: 'drizzle', ui: 'shadcn', stack: 'generic-node' },
  { orm: 'mikro-orm', ui: 'open-mercato-ui', stack: 'generic-node' },
]
for (const axis of Object.keys(adaptersByAxis))
  for (const a of adaptersByAxis[axis]) matrix.push({ [axis]: a })

const skills = ls(join(ROOT, 'core/ai/skills')).filter((n) =>
  existsSync(join(ROOT, 'core/ai/skills', n, 'SKILL.md')))

// Which slots does each skill's generic body declare? Use the renderer's own (anchored,
// full-line) definition so the gate and renderer agree — a `SLOT:` mention in prose is not a slot.
const declaredSlots = {}
for (const s of skills) {
  const body = readFileSync(join(ROOT, 'core/ai/skills', s, 'SKILL.md'), 'utf8')
  declaredSlots[s] = body.split('\n').map((l) => l.match(SLOT_OPEN)).filter(Boolean).map((m) => m[1])
}

// Every declared slot must be fillable by at least one adapter on its axis (typo guard).
const adapterSlotNames = (axis) => {
  const names = new Set()
  for (const a of adaptersByAxis[axis] || []) {
    const ad = JSON.parse(readFileSync(join(ROOT, 'adapters', axis, a, 'adapter.json'), 'utf8'))
    for (const k of Object.keys(ad.slots || {})) names.add(k)
  }
  return names
}

let failures = 0, checks = 0
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`) }

for (const s of skills) {
  for (const slot of declaredSlots[s]) {
    const axis = slot.split('.')[0]
    checks++
    if (!adapterSlotNames(axis).has(slot)) fail(`${s}: slot '${slot}' is filled by no ${axis} adapter (typo or missing adapter content)`)
  }
}

for (const s of skills) {
  for (const sel of matrix) {
    const a = renderSkill(ROOT, sel, s)
    const b = renderSkill(ROOT, sel, s)
    checks += 2
    if (a.digest !== b.digest) fail(`${s} @ ${JSON.stringify(sel)}: non-deterministic (${a.digest} != ${b.digest})`)
    if (a.rendered.split('\n').some((l) => SLOT_ANY.test(l))) fail(`${s} @ ${JSON.stringify(sel)}: leftover SLOT marker (neither filled nor pruned)`)
  }
}

console.log(`check-render: ${checks} checks across ${skills.length} skills × ${matrix.length} selections`)
if (failures) { console.error(`FAILED: ${failures} problem(s).`); process.exit(1) }
console.log('OK — deterministic, no leftover slots, all declared slots fillable.')
