// Integration tests for `aef add` / `aef remove`, driven through runInit then
// runAdd/runRemove against a temp consumer initialised from the bundled example config
// (orm: drizzle, ui: shadcn). Verifies axis re-selection, skill install/uninstall, and
// that local edits to surviving skills are preserved across a re-selection.
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
import { beforeEach, afterEach, test, expect, describe } from 'vitest'
import { runInit } from '../src/cli/commands/init.js'
import { runAdd, runRemove } from '../src/cli/commands/adapter.js'

let consumer: string
const cfg = () => JSON.parse(readFileSync(join(consumer, 'framework.config.json'), 'utf8'))
const skillDir = (s: string) => join(consumer, '.ai', 'skills', s)
const skillMd = (s: string) => join(skillDir(s), 'SKILL.md')

beforeEach(async () => {
  consumer = mkdtempSync(join(tmpdir(), 'agentic-adapter-'))
  await runInit({ config: join(ROOT, 'framework.config.example.json'), out: consumer })
  process.exitCode = 0
})
afterEach(() => {
  rmSync(consumer, { recursive: true, force: true })
  process.exitCode = 0
})

describe('add / remove', () => {
  test('remove clears the axis and uninstalls its skills', () => {
    expect(existsSync(skillDir('migrate-orm'))).toBe(true)
    runRemove('drizzle', { out: consumer })
    expect(cfg().orm).toBeNull()
    expect(existsSync(skillDir('migrate-orm'))).toBe(false)
    // a non-axis skill stays installed
    expect(existsSync(skillDir('code-review'))).toBe(true)
  })

  test('add switches the active adapter and re-renders its skill content', () => {
    runRemove('drizzle', { out: consumer })
    runAdd('mikro-orm', { out: consumer })
    expect(cfg().orm).toBe('mikro-orm')
    expect(existsSync(skillMd('migrate-orm'))).toBe(true)
    const body = readFileSync(skillMd('migrate-orm'), 'utf8')
    expect(body).toMatch(/MikroORM/)
    expect(body).not.toMatch(/Drizzle/)
  })

  test('switching ORM in place preserves a local edit to a surviving skill', () => {
    // edit a skill that is NOT on the orm axis, so it survives the re-selection
    const marker = '\n<!-- my local note -->\n'
    writeFileSync(skillMd('code-review'), readFileSync(skillMd('code-review'), 'utf8') + marker)
    runAdd('mikro-orm', { out: consumer }) // drizzle -> mikro-orm
    expect(cfg().orm).toBe('mikro-orm')
    expect(readFileSync(skillMd('code-review'), 'utf8')).toMatch(/my local note/)
  })

  test('remove of a non-active adapter is rejected', () => {
    expect(() => runRemove('mikro-orm', { out: consumer })).toThrow(/not the active orm/)
  })

  test('unknown adapter name throws', () => {
    expect(() => runAdd('nonexistent-xyz', { out: consumer })).toThrow(/no adapter/)
  })

  test('add tier installs its skills, writes tiers to config, and installs outbox', () => {
    const outbox = join(consumer, '.ai', 'framework-feedback')
    expect(existsSync(skillDir('improve-framework'))).toBe(false)
    expect(existsSync(outbox)).toBe(false)
    runAdd('framework', { out: consumer })
    expect(cfg().tiers).toContain('framework')
    expect(existsSync(skillDir('improve-framework'))).toBe(true)
    expect(existsSync(outbox)).toBe(true)
  })

  test('remove tier uninstalls its skills, removes tiers key when empty, and removes outbox', () => {
    const outbox = join(consumer, '.ai', 'framework-feedback')
    runAdd('framework', { out: consumer })
    expect(existsSync(skillDir('improve-framework'))).toBe(true)
    expect(existsSync(outbox)).toBe(true)
    runRemove('framework', { out: consumer })
    expect(cfg().tiers).toBeUndefined()
    expect(existsSync(skillDir('improve-framework'))).toBe(false)
    expect(existsSync(outbox)).toBe(false)
  })

  test('remove non-enabled tier is rejected', () => {
    expect(() => runRemove('framework', { out: consumer })).toThrow(/not enabled/)
  })

  test('add default tier is rejected', () => {
    expect(() => runAdd('core', { out: consumer })).toThrow(/default tier/)
  })
})
