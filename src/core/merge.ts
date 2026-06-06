// 3-way merge delegated to git — no custom merge engine. BASE = last render,
// LOCAL = on-disk (with consumer edits), THEIRS = fresh framework render.
// Returns the merged text and the conflict count git reports.
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

export interface MergeResult {
  merged: string
  conflicts: number
}

export function mergeFile(local: string, base: string, theirs: string): MergeResult {
  const dir = mkdtempSync(join(tmpdir(), 'agentic-merge-'))
  const lp = join(dir, 'local')
  const bp = join(dir, 'base')
  const tp = join(dir, 'theirs')
  writeFileSync(lp, local)
  writeFileSync(bp, base)
  writeFileSync(tp, theirs)
  const r = spawnSync(
    'git',
    [
      'merge-file',
      '-p',
      '-L',
      'ours (your local edits)',
      '-L',
      'base (last sync)',
      '-L',
      'theirs (framework update)',
      lp,
      bp,
      tp,
    ],
    { encoding: 'utf8' },
  )
  rmSync(dir, { recursive: true, force: true })
  if (r.status === null || r.status < 0 || r.status >= 255)
    throw new Error(`git merge-file failed: ${r.stderr || String(r.error)}`)
  return { merged: r.stdout, conflicts: r.status }
}
