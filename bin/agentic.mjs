#!/usr/bin/env node
// agentic — minimal CLI for the extracted framework (PoC).
//
//   agentic init --config <cfg> --out <consumerDir> [--copy]
//
// Renders the full configured skill set into <out>/.ai/skills/, writes a render manifest
// (the sync base), and wires each configured harness's skills dir with per-skill symlinks
// (or copies with --copy). Skill selection = tier membership AND required-axis availability,
// so e.g. migrate-orm is omitted entirely when no ORM is configured.

import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, rmSync, cpSync, symlinkSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSkill } from './lib/render-skill.mjs'

const FRAMEWORK_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}
const has = (flag) => process.argv.includes(flag)

const cmd = process.argv[2]
if (cmd !== 'init') {
  console.error('usage: agentic init --config <cfg> --out <consumerDir> [--copy]')
  process.exit(1)
}

const root = FRAMEWORK_ROOT
const configPath = arg('--config', join(root, 'framework.config.example.json'))
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const out = arg('--out', join(root, 'examples/consumer'))
const useCopy = has('--copy')

// ── Skill selection: tiers ∧ required axis present ────────────────────────────
const tiers = JSON.parse(readFileSync(join(root, 'core/ai/skills/tiers.json'), 'utf8'))
const selectedTiers = tiers.default
const requires = tiers.requires || {}
const candidates = []
for (const t of selectedTiers) for (const s of tiers.tiers[t].skills) if (!candidates.includes(s)) candidates.push(s)

const skills = []
const skipped = []
for (const s of candidates) {
  const axis = requires[s]
  if (axis && !config[axis]) skipped.push(`${s} (needs ${axis})`)
  else skills.push(s)
}
skills.sort()

// ── Render the set ────────────────────────────────────────────────────────────
const aiSkills = join(out, '.ai', 'skills')
const manifestSkills = {}
for (const skill of skills) {
  const { rendered, manifest, digest } = renderSkill(root, config, skill)
  const dest = join(aiSkills, skill)
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'SKILL.md'), rendered)
  writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
  manifestSkills[skill] = { digest, inputs: manifest.inputs }
}

// Render manifest = the sync base (deterministic; no timestamps).
mkdirSync(join(out, '.ai'), { recursive: true })
writeFileSync(
  join(out, '.ai', '.render-manifest.json'),
  JSON.stringify({ selection: pick(config, ['orm', 'ui', 'stack', 'harnesses']), skills: manifestSkills }, null, 2) + '\n',
)
// Persist the resolved config in the consumer.
writeFileSync(join(out, 'framework.config.json'), JSON.stringify(config, null, 2) + '\n')

// ── Wire each harness ───────────────────────────────────────────────────────
const wired = []
for (const harness of config.harnesses || []) {
  const adPath = join(root, 'adapters', 'harness', harness, 'adapter.json')
  if (!existsSync(adPath)) { console.warn(`! no harness adapter '${harness}', skipping`); continue }
  const ad = JSON.parse(readFileSync(adPath, 'utf8'))
  const hdir = join(out, ad.skillsDir)
  mkdirSync(hdir, { recursive: true })
  for (const skill of skills) {
    const link = join(hdir, skill)
    if (existsSync(link) || isLink(link)) rmSync(link, { recursive: true, force: true })
    if (useCopy) {
      cpSync(join(aiSkills, skill), link, { recursive: true })
    } else {
      symlinkSync(`${ad.linkBase}/${skill}`, link)
    }
  }
  wired.push(`${harness} -> ${ad.skillsDir} (${useCopy ? 'copy' : 'symlink'})`)
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`Initialised agentic framework into ${relative(process.cwd(), out) || '.'}`)
console.log(`  skills installed: ${skills.join(', ') || '(none)'}`)
if (skipped.length) console.log(`  skipped (axis not configured): ${skipped.join(', ')}`)
console.log(`  harnesses wired: ${wired.join(' | ') || '(none)'}`)

function pick(o, keys) { const r = {}; for (const k of keys) if (k in o) r[k] = o[k]; return r }
function isLink(p) { try { return lstatSync(p).isSymbolicLink() } catch { return false } }
