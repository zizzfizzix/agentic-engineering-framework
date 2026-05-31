#!/usr/bin/env node
// agentic — minimal CLI for the extracted framework (PoC).
//
//   agentic init  --config <cfg> --out <consumerDir> [--copy]
//   agentic sync             --out <consumerDir>
//
// init  renders the full configured skill set into <out>/.ai/skills/, snapshots a BASE under
//       <out>/.ai/.base/, writes a render manifest (sync base), and wires each harness.
// sync  re-renders from the (updated) framework source and reconciles with local edits using a
//       git-native 3-way merge (BASE = last render, LOCAL = on-disk, NEW = fresh render).

import { readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, rmSync, cpSync, symlinkSync, mkdtempSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { renderSkill } from './lib/render-skill.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def
}
const has = (flag) => process.argv.includes(flag)
const pick = (o, keys) => { const r = {}; for (const k of keys) if (k in o) r[k] = o[k]; return r }
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink() } catch { return false } }

const cmd = process.argv[2]
if (cmd === 'init') cmdInit()
else if (cmd === 'sync') cmdSync()
else { console.error('usage: agentic <init|sync> --out <consumerDir> [--config <cfg>] [--copy]'); process.exit(1) }

// ── init ──────────────────────────────────────────────────────────────────────
function cmdInit() {
  const configPath = arg('--config', join(ROOT, 'framework.config.example.json'))
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const out = arg('--out', join(ROOT, 'examples/consumer'))
  const useCopy = has('--copy')

  const { skills, skipped } = selectSkills(config)

  const manifestSkills = {}
  for (const skill of skills) {
    const { rendered, manifest, digest } = renderSkill(ROOT, config, skill)
    writeSkill(out, skill, rendered, manifest)      // .ai/skills/<skill>/...
    writeBase(out, skill, rendered)                 // .ai/.base/<skill>/SKILL.md
    manifestSkills[skill] = { digest, inputs: manifest.inputs }
  }
  writeManifest(out, config, manifestSkills)
  writeFileSync(join(out, 'framework.config.json'), JSON.stringify(config, null, 2) + '\n')

  const wired = wireHarnesses(out, config, skills, useCopy)

  console.log(`Initialised agentic framework into ${relative(process.cwd(), out) || '.'}`)
  console.log(`  skills installed: ${skills.join(', ') || '(none)'}`)
  if (skipped.length) console.log(`  skipped (axis not configured): ${skipped.join(', ')}`)
  console.log(`  harnesses wired: ${wired.join(' | ') || '(none)'}`)
}

// ── sync ──────────────────────────────────────────────────────────────────────
function cmdSync() {
  const out = arg('--out', join(ROOT, 'examples/consumer'))
  const config = JSON.parse(readFileSync(join(out, 'framework.config.json'), 'utf8'))
  const manifestPath = join(out, '.ai', '.render-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  const report = []
  let conflicts = 0
  for (const skill of Object.keys(manifest.skills)) {
    const { rendered: NEW, digest: newDigest } = renderSkill(ROOT, config, skill)
    const basePath = join(out, '.ai', '.base', skill, 'SKILL.md')
    const localPath = join(out, '.ai', 'skills', skill, 'SKILL.md')
    const BASE = readFileSync(basePath, 'utf8')
    const LOCAL = readFileSync(localPath, 'utf8')

    if (NEW === BASE) {
      report.push(`  = ${skill}: framework unchanged${LOCAL === BASE ? '' : ' (local edits kept)'}`)
      continue
    }
    if (LOCAL === BASE) {
      writeFileSync(localPath, NEW); writeFileSync(basePath, NEW)
      manifest.skills[skill].digest = newDigest
      report.push(`  ↑ ${skill}: updated (no local edits)`)
      continue
    }
    // both changed -> git-native 3-way merge
    const { merged, n } = mergeFile(LOCAL, BASE, NEW)
    writeFileSync(localPath, merged)
    writeFileSync(basePath, NEW)            // base advances to the framework's NEW
    manifest.skills[skill].digest = newDigest
    conflicts += n
    report.push(`  ⇄ ${skill}: merged local edits + framework update${n ? ` — ${n} CONFLICT(S), resolve in working tree` : ' (clean)'}`)
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

  console.log(`Synced ${relative(process.cwd(), out) || '.'} from framework source`)
  report.forEach((l) => console.log(l))
  if (conflicts) {
    console.log(`\n${conflicts} conflict(s) written as <<<<<<< markers. Review with 'git diff', resolve, commit.`)
    process.exitCode = 2
  }
}

// ── 3-way merge via git (no custom engine) ─────────────────────────────────────
function mergeFile(local, base, theirs) {
  const dir = mkdtempSync(join(tmpdir(), 'agentic-merge-'))
  const lp = join(dir, 'local'), bp = join(dir, 'base'), tp = join(dir, 'theirs')
  writeFileSync(lp, local); writeFileSync(bp, base); writeFileSync(tp, theirs)
  const r = spawnSync('git', [
    'merge-file', '-p',
    '-L', 'ours (your local edits)', '-L', 'base (last sync)', '-L', 'theirs (framework update)',
    lp, bp, tp,
  ], { encoding: 'utf8' })
  rmSync(dir, { recursive: true, force: true })
  if (r.status === null || r.status < 0 || r.status >= 255) throw new Error(`git merge-file failed: ${r.stderr || r.error}`)
  return { merged: r.stdout, n: r.status }
}

// ── shared helpers ──────────────────────────────────────────────────────────
function selectSkills(config) {
  const tiers = JSON.parse(readFileSync(join(ROOT, 'core/ai/skills/tiers.json'), 'utf8'))
  const requires = tiers.requires || {}
  const candidates = []
  for (const t of tiers.default) for (const s of tiers.tiers[t].skills) if (!candidates.includes(s)) candidates.push(s)
  const skills = [], skipped = []
  for (const s of candidates) {
    const axis = requires[s]
    if (axis && !config[axis]) skipped.push(`${s} (needs ${axis})`)
    else skills.push(s)
  }
  return { skills: skills.sort(), skipped }
}

function writeSkill(out, skill, rendered, manifest) {
  const dest = join(out, '.ai', 'skills', skill)
  mkdirSync(dest, { recursive: true })
  writeFileSync(join(dest, 'SKILL.md'), rendered)
  writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')
}
function writeBase(out, skill, rendered) {
  const d = join(out, '.ai', '.base', skill)
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'SKILL.md'), rendered)
}
function writeManifest(out, config, skills) {
  mkdirSync(join(out, '.ai'), { recursive: true })
  writeFileSync(
    join(out, '.ai', '.render-manifest.json'),
    JSON.stringify({ selection: pick(config, ['orm', 'ui', 'stack', 'harnesses']), skills }, null, 2) + '\n',
  )
}
function wireHarnesses(out, config, skills, useCopy) {
  const aiSkills = join(out, '.ai', 'skills')
  const wired = []
  for (const harness of config.harnesses || []) {
    const adPath = join(ROOT, 'adapters', 'harness', harness, 'adapter.json')
    if (!existsSync(adPath)) { console.warn(`! no harness adapter '${harness}', skipping`); continue }
    const ad = JSON.parse(readFileSync(adPath, 'utf8'))
    const hdir = join(out, ad.skillsDir)
    mkdirSync(hdir, { recursive: true })
    for (const skill of skills) {
      const link = join(hdir, skill)
      if (existsSync(link) || isLink(link)) rmSync(link, { recursive: true, force: true })
      if (useCopy) cpSync(join(aiSkills, skill), link, { recursive: true })
      else symlinkSync(`${ad.linkBase}/${skill}`, link)
    }
    wired.push(`${harness} -> ${ad.skillsDir} (${useCopy ? 'copy' : 'symlink'})`)
  }
  return wired
}
