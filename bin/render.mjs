#!/usr/bin/env node
// Single-skill render PoC (thin wrapper over bin/lib/render-skill.mjs).
// See docs/render-poc.md. For the full configured set + harness wiring, use bin/agentic.mjs init.
//
// Usage: node bin/render.mjs [--config <cfg>] [--skill <name>] [--out <dir>] [--root <repoRoot>]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { renderSkill } from './lib/render-skill.mjs'

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const root = arg('--root', process.cwd())
const config = JSON.parse(readFileSync(arg('--config', join(root, 'framework.config.example.json')), 'utf8'))
const skill = arg('--skill', 'migrate-orm')
const outDir = arg('--out', join(root, 'examples/rendered'))

const { rendered, manifest, digest } = renderSkill(root, config, skill)
const dest = join(outDir, skill)
mkdirSync(dest, { recursive: true })
writeFileSync(join(dest, 'SKILL.md'), rendered)
writeFileSync(join(dest, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`Rendered '${skill}' (orm=${manifest.selection.orm || 'none'}) -> ${relative(root, dest)}`)
console.log(`  digest ${digest} · ${manifest.regions.length} provenance regions · ${manifest.inputs.length} inputs`)
