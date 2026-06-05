// Shared per-skill reconcile: render a skill from the current framework source and
// fold the result into a consumer, preserving local edits via a git-native 3-way merge.
// Used by both `agentic sync` and `agentic add`/`remove` so the reconcile semantics —
// fast-forward, clean merge, conflict, and provenance refresh — live in exactly one place.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { renderSkill, type InputRef } from '../core/render.js'
import { mergeFile } from '../core/merge.js'
import type { FrameworkConfig } from '../core/contracts.js'
import { writeSkill, writeBase } from './consumer-io.js'

export type ReconcileStatus = 'installed' | 'unchanged' | 'forwarded' | 'merged' | 'conflict'

export interface ReconcileResult {
  status: ReconcileStatus
  digest: string
  inputs: InputRef[]
  conflicts: number
}

/**
 * Reconcile one skill in `out` against the current render:
 *  - not yet on disk            → install fresh (+ BASE),
 *  - framework unchanged        → leave LOCAL alone (local edits kept),
 *  - framework changed, no edits → fast-forward to NEW,
 *  - both changed               → 3-way merge (conflicts land as <<<<<<< markers).
 * Always refreshes provenance.json to the fresh render and returns the new digest/inputs
 * so the caller can update the render manifest.
 */
export function reconcileSkill(
  root: string,
  out: string,
  config: FrameworkConfig,
  skill: string,
): ReconcileResult {
  const { rendered: NEW, manifest, digest } = renderSkill(root, config, skill)
  const skillMd = join(out, '.ai', 'skills', skill, 'SKILL.md')

  if (!existsSync(skillMd)) {
    writeSkill(out, skill, NEW, manifest)
    writeBase(out, skill, NEW)
    return { status: 'installed', digest, inputs: manifest.inputs, conflicts: 0 }
  }

  const baseMd = join(out, '.ai', '.base', skill, 'SKILL.md')
  const BASE = existsSync(baseMd) ? readFileSync(baseMd, 'utf8') : NEW
  const LOCAL = readFileSync(skillMd, 'utf8')

  let status: ReconcileStatus = 'unchanged'
  let conflicts = 0
  if (NEW !== BASE) {
    if (LOCAL === BASE) {
      writeFileSync(skillMd, NEW)
      status = 'forwarded'
    } else {
      const { merged, conflicts: n } = mergeFile(LOCAL, BASE, NEW)
      writeFileSync(skillMd, merged)
      conflicts = n
      status = n ? 'conflict' : 'merged'
    }
    writeBase(out, skill, NEW)
  }
  // Provenance always tracks the fresh render (improve-framework reads it to route edits).
  writeFileSync(
    join(out, '.ai', 'skills', skill, 'provenance.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  )
  return { status, digest, inputs: manifest.inputs, conflicts }
}
