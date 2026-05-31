// Integration tests for the four `sync` reconcile cases, driven through the real
// runInit/runSync against a temp consumer. The framework source is unchanged between
// init and sync, so we simulate "the framework moved on" by rewriting the BASE
// snapshot (and LOCAL) — NEW is always the current render.
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
  await runInit({ out: consumer })
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
