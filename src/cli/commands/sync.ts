// `agentic sync` — re-render from the (updated) framework source and reconcile with
// local edits via a git-native 3-way merge (BASE = last render, LOCAL = on-disk,
// NEW = fresh render). Exit code 2 signals unresolved conflicts written to the tree.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema } from '../../core/contracts.js'
import { FRAMEWORK_ROOT } from '../root.js'
import { reconcileSkill, type ReconcileStatus } from '../reconcile.js'
import type { ManifestSkills } from '../consumer-io.js'

interface RenderManifestFile {
  selection: unknown
  skills: ManifestSkills
}

const REPORT: Record<ReconcileStatus, (s: string) => string> = {
  installed: (s) => `  + ${s}: installed`,
  unchanged: (s) => `  = ${s}: framework unchanged`,
  forwarded: (s) => `  ↑ ${s}: updated (no local edits)`,
  merged: (s) => `  ⇄ ${s}: merged local edits + framework update (clean)`,
  conflict: (s) => `  ⇄ ${s}: merged — CONFLICT(S), resolve in working tree`,
}

export interface SyncOptions {
  out?: string
}

export function runSync(opts: SyncOptions): void {
  const root = FRAMEWORK_ROOT
  const out = opts.out ?? join(root, 'examples/consumer')
  const config = FrameworkConfigSchema.parse(
    JSON.parse(readFileSync(join(out, 'framework.config.json'), 'utf8')),
  )
  const manifestPath = join(out, '.ai', '.render-manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as RenderManifestFile

  const report: string[] = []
  let conflicts = 0
  for (const skill of Object.keys(manifest.skills)) {
    const r = reconcileSkill(root, out, config, skill)
    manifest.skills[skill] = { digest: r.digest, inputs: r.inputs }
    conflicts += r.conflicts
    report.push(REPORT[r.status](skill))
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

  console.log(`Synced ${relative(process.cwd(), out) || '.'} from framework source`)
  // Refresh synced read-only framework lessons (loop closure, decision #8).
  const fwLessonsSrc = join(root, 'core', 'ai', 'lessons.framework.md')
  if (existsSync(fwLessonsSrc)) {
    const dest = join(out, '.ai', 'lessons.framework.md')
    const next = readFileSync(fwLessonsSrc, 'utf8')
    if (!existsSync(dest) || readFileSync(dest, 'utf8') !== next) {
      writeFileSync(dest, next)
      report.push('  ↑ lessons.framework.md: refreshed (synced, read-only)')
    }
  }

  report.forEach((l) => console.log(l))
  if (conflicts) {
    console.log(
      `\n${conflicts} conflict(s) written as <<<<<<< markers. Review with 'git diff', resolve, commit.`,
    )
    process.exitCode = 2
  }
}
