// Golden tests — the byte-equality guard on the framework's most important property:
// deterministic, contractual rendered output (sync's 3-way merge depends on it). Any
// intentional change must be reflected by regenerating fixtures (`pnpm goldens:update`)
// and reviewing the diff in the same PR.
import { readFileSync, lstatSync, readdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { test, expect, describe } from 'vitest'
import { renderSkill } from '../src/core/render.js'
import { FrameworkConfigSchema } from '../src/core/contracts.js'
import { runInit } from '../src/cli/commands/init.js'

const ROOT = process.cwd()
const cfg = FrameworkConfigSchema.parse(
  JSON.parse(readFileSync(join(ROOT, 'framework.config.example.json'), 'utf8')),
)

// Recursively collect relative paths of regular files (symlinks excluded — harness
// skill dirs are symlinks whose targets we don't byte-compare).
function regularFiles(root: string, base = root): string[] {
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    const st = lstatSync(full)
    if (st.isSymbolicLink()) continue
    if (st.isDirectory()) out.push(...regularFiles(full, base))
    else out.push(relative(base, full))
  }
  return out
}

describe('goldens: examples/rendered', () => {
  test.each(['migrate-orm', 'ui-consistency'])('%s renders byte-identical to its golden', (skill) => {
    const { rendered, manifest } = renderSkill(ROOT, cfg, skill)
    expect(rendered).toBe(readFileSync(join(ROOT, 'examples/rendered', skill, 'SKILL.md'), 'utf8'))
    expect(JSON.stringify(manifest, null, 2) + '\n').toBe(
      readFileSync(join(ROOT, 'examples/rendered', skill, 'provenance.json'), 'utf8'),
    )
  })
})

describe('goldens: examples/consumer', () => {
  test('init reproduces the committed consumer tree byte-for-byte', async () => {
    const golden = join(ROOT, 'examples/consumer')
    const tmp = mkdtempSync(join(tmpdir(), 'agentic-golden-'))
    try {
      await runInit({ out: tmp })
      const files = regularFiles(golden)
      expect(files.length).toBeGreaterThan(0)
      for (const rel of files) {
        expect(readFileSync(join(tmp, rel), 'utf8'), `mismatch: ${rel}`).toBe(
          readFileSync(join(golden, rel), 'utf8'),
        )
      }
      // and no extra regular files were produced
      expect(regularFiles(tmp).sort()).toEqual(files.sort())
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
