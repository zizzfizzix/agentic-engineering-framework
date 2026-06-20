// Integration tests for the four `sync` reconcile cases, driven through the real
// runInit/runSync against a temp consumer. The framework source is unchanged between
// init and sync, so we simulate "the framework moved on" by rewriting the BASE
// snapshot (and LOCAL) — NEW is always the current render.
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
import { beforeEach, afterEach, test, expect, describe } from 'vitest'
import { runInit } from '../src/cli/commands/init.js'
import { runSync } from '../src/cli/commands/sync.js'

const SKILL = 'migrate-orm'
let consumer: string

const baseP = () => join(consumer, '.ai', '.base', SKILL, 'SKILL.md')
const localP = () => join(consumer, '.ai', 'skills', SKILL, 'SKILL.md')
const read = (p: string) => readFileSync(p, 'utf8')

beforeEach(async () => {
  consumer = mkdtempSync(join(tmpdir(), 'agentic-sync-'))
  await runInit({ config: join(ROOT, 'framework.config.example.json'), out: consumer })
  process.exitCode = 0
})
afterEach(() => {
  rmSync(consumer, { recursive: true, force: true })
  process.exitCode = 0 // runSync sets this to 2 on conflict; don't leak into the runner
})

describe('sync reconcile', () => {
  test('framework unchanged + no local edits = no-op', () => {
    const before = read(localP())
    runSync({ out: consumer })
    expect(read(localP())).toBe(before)
    expect(process.exitCode).toBe(0)
  })

  test('fast-forward: framework moved, no local edits → adopt NEW', () => {
    const current = read(localP()) // == NEW (current render)
    const stale = current.replace('Drizzle', 'OLDORM')
    writeFileSync(baseP(), stale)
    writeFileSync(localP(), stale) // LOCAL == BASE → no local edits

    runSync({ out: consumer })

    expect(read(localP())).toBe(current) // adopted the fresh render verbatim
    expect(read(baseP())).toBe(current)
    expect(process.exitCode).toBe(0)
  })

  test('clean merge: framework change + non-overlapping local edit', () => {
    const current = read(localP())
    const base = current.replace('Drizzle', 'OLDORM') // NEW restores "Drizzle" vs BASE
    const local = base.replace(/\n$/, '\n<!-- local note -->\n') // edit far away
    writeFileSync(baseP(), base)
    writeFileSync(localP(), local)

    runSync({ out: consumer })

    const merged = read(localP())
    expect(merged).toMatch(/Drizzle/) // framework change applied
    expect(merged).toMatch(/local note/) // local edit preserved
    expect(merged).not.toMatch(/<<<<<<</) // clean, no conflict markers
    expect(process.exitCode).toBe(0)
  })

  test('sync installs a new skill when a tier is added to the config', () => {
    const cfgPath = join(consumer, 'framework.config.json')
    const raw = JSON.parse(readFileSync(cfgPath, 'utf8'))
    raw.tiers = ['framework']
    writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n')

    expect(existsSync(join(consumer, '.ai', 'skills', 'improve-framework'))).toBe(false)
    runSync({ out: consumer })
    expect(existsSync(join(consumer, '.ai', 'skills', 'improve-framework'))).toBe(true)
  })

  test('sync removes a skill when its required axis is cleared from the config', () => {
    const cfgPath = join(consumer, 'framework.config.json')
    const raw = JSON.parse(readFileSync(cfgPath, 'utf8'))
    raw.orm = null
    writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n')

    expect(existsSync(join(consumer, '.ai', 'skills', 'migrate-orm'))).toBe(true)
    runSync({ out: consumer })
    expect(existsSync(join(consumer, '.ai', 'skills', 'migrate-orm'))).toBe(false)
    // unrelated skills are unaffected
    expect(existsSync(join(consumer, '.ai', 'skills', 'code-review'))).toBe(true)
  })

  test('manifest selection reflects tiers after sync', () => {
    const cfgPath = join(consumer, 'framework.config.json')
    const raw = JSON.parse(readFileSync(cfgPath, 'utf8'))
    raw.tiers = ['framework']
    writeFileSync(cfgPath, JSON.stringify(raw, null, 2) + '\n')

    runSync({ out: consumer })

    const manifest = JSON.parse(readFileSync(join(consumer, '.ai', '.render-manifest.json'), 'utf8'))
    expect(manifest.selection.tiers).toContain('framework')
  })

  test('conflict: framework and local edit the same line', () => {
    const current = read(localP())
    const base = current.replace('Drizzle', 'OLDORM')
    const local = base.replace('OLDORM', 'MYORM') // same line, different from NEW's "Drizzle"
    writeFileSync(baseP(), base)
    writeFileSync(localP(), local)

    runSync({ out: consumer })

    const merged = read(localP())
    expect(merged).toMatch(/<<<<<<</) // conflict markers written to the tree
    expect(merged).toMatch(/MYORM/)
    expect(process.exitCode).toBe(2) // non-zero exit signals unresolved conflicts
  })
})
