// `agentic sync` — re-render from the (updated) framework source and reconcile with
// local edits via a git-native 3-way merge (BASE = last render, LOCAL = on-disk,
// NEW = fresh render). Exit code 2 signals unresolved conflicts written to the tree.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { FrameworkConfigSchema } from '../../core/contracts.js'
import { renderSkill } from '../../core/render.js'
import { mergeFile } from '../../core/merge.js'
import { FRAMEWORK_ROOT } from '../root.js'

interface RenderManifestFile {
  selection: unknown
  skills: Record<string, { digest: string; inputs: unknown }>
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
    const { rendered: NEW, digest: newDigest } = renderSkill(root, config, skill)
    const basePath = join(out, '.ai', '.base', skill, 'SKILL.md')
    const localPath = join(out, '.ai', 'skills', skill, 'SKILL.md')
    const BASE = readFileSync(basePath, 'utf8')
    const LOCAL = readFileSync(localPath, 'utf8')

    if (NEW === BASE) {
      report.push(`  = ${skill}: framework unchanged${LOCAL === BASE ? '' : ' (local edits kept)'}`)
      continue
    }
    if (LOCAL === BASE) {
      writeFileSync(localPath, NEW)
      writeFileSync(basePath, NEW)
      manifest.skills[skill]!.digest = newDigest
      report.push(`  ↑ ${skill}: updated (no local edits)`)
      continue
    }
    // both changed -> git-native 3-way merge
    const { merged, conflicts: n } = mergeFile(LOCAL, BASE, NEW)
    writeFileSync(localPath, merged)
    writeFileSync(basePath, NEW) // base advances to the framework's NEW
    manifest.skills[skill]!.digest = newDigest
    conflicts += n
    report.push(
      `  ⇄ ${skill}: merged local edits + framework update${n ? ` — ${n} CONFLICT(S), resolve in working tree` : ' (clean)'}`,
    )
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

  console.log(`Synced ${relative(process.cwd(), out) || '.'} from framework source`)
  report.forEach((l) => console.log(l))
  if (conflicts) {
    console.log(
      `\n${conflicts} conflict(s) written as <<<<<<< markers. Review with 'git diff', resolve, commit.`,
    )
    process.exitCode = 2
  }
}
