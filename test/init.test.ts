// Unit tests for `aef init` error handling and tier-gated conventions.
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, describe } from 'vitest'
import { runInit } from '../src/cli/commands/init.js'
import { migrateConfigName } from '../src/cli/consumer-io.js'

const ROOT = process.cwd()

describe('runInit error handling', () => {
  test('throws a helpful error when --config is omitted and not interactive', async () => {
    await expect(runInit({})).rejects.toThrow('--config is required')
  })

  test('error message mentions --interactive for guided setup', async () => {
    await expect(runInit({})).rejects.toThrow('--interactive for guided setup')
  })

  test('error message includes usage example without --copy', async () => {
    const err = await runInit({}).catch((e: Error) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('aef init --config aef.config.json --out .')
    expect((err as Error).message).not.toContain('--copy')
  })

  test('error message includes --interactive usage example', async () => {
    await expect(runInit({})).rejects.toThrow('aef init --interactive')
  })

  test('error message includes minimum config snippet', async () => {
    await expect(runInit({})).rejects.toThrow('"harnesses": ["claude-code"]')
  })

  test('error message includes --help pointer', async () => {
    await expect(runInit({})).rejects.toThrow("'aef init --help'")
  })
})

describe('runInit package.json pinning', () => {
  test('adds @zizzfizzix/aef to devDependencies and scripts when package.json exists', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-pkg-'))
    writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'my-app' }, null, 2) + '\n')
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await runInit({ config: cfgPath, out })
      const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'))
      expect(pkg.devDependencies?.['@zizzfizzix/aef']).toMatch(/^\^\d+\.\d+\.\d+/)
      expect(pkg.scripts?.['aef']).toBe('aef')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('preserves existing package.json fields when adding entries', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-pkg-'))
    writeFileSync(
      join(out, 'package.json'),
      JSON.stringify(
        { name: 'my-app', scripts: { build: 'tsc' }, devDependencies: { typescript: '^5.0.0' } },
        null,
        2,
      ) + '\n',
    )
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await runInit({ config: cfgPath, out })
      const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'))
      expect(pkg.scripts?.['build']).toBe('tsc')
      expect(pkg.devDependencies?.['typescript']).toBe('^5.0.0')
      expect(pkg.devDependencies?.['@zizzfizzix/aef']).toMatch(/^\^\d+\.\d+\.\d+/)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('does not throw when package.json is absent', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-nopkg-'))
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await expect(runInit({ config: cfgPath, out })).resolves.toBeUndefined()
      expect(existsSync(join(out, 'package.json'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('updates an existing stale @zizzfizzix/aef pin to the current version (L1)', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-pkg-'))
    writeFileSync(
      join(out, 'package.json'),
      JSON.stringify({ name: 'my-app', devDependencies: { '@zizzfizzix/aef': '^0.0.1' } }, null, 2) + '\n',
    )
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await runInit({ config: cfgPath, out })
      const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'))
      expect(pkg.devDependencies?.['@zizzfizzix/aef']).not.toBe('^0.0.1')
      expect(pkg.devDependencies?.['@zizzfizzix/aef']).toMatch(/^\^\d+\.\d+\.\d+/)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('preserves non-default (4-space) indentation of existing package.json (M1)', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-pkg-'))
    writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'my-app' }, null, 4) + '\n')
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await runInit({ config: cfgPath, out })
      const raw = readFileSync(join(out, 'package.json'), 'utf8')
      expect(raw).toMatch(/\n {4}"/)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('throws a friendly error when package.json is malformed (L2)', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-pkg-'))
    writeFileSync(join(out, 'package.json'), 'not valid json')
    const cfgPath = join(ROOT, 'aef.config.example.json')
    try {
      await expect(runInit({ config: cfgPath, out })).rejects.toThrow('Failed to parse')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})

describe('migrateConfigName', () => {
  test('renames framework.config.json → aef.config.json when only the legacy file exists', () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-migrate-'))
    try {
      writeFileSync(join(out, 'framework.config.json'), '{"harnesses":["claude-code"]}')
      expect(existsSync(join(out, 'aef.config.json'))).toBe(false)
      migrateConfigName(out)
      expect(existsSync(join(out, 'aef.config.json'))).toBe(true)
      expect(existsSync(join(out, 'framework.config.json'))).toBe(false)
      expect(readFileSync(join(out, 'aef.config.json'), 'utf8')).toBe('{"harnesses":["claude-code"]}')
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('leaves aef.config.json untouched when both files are present', () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-migrate-'))
    try {
      writeFileSync(join(out, 'aef.config.json'), '{"harnesses":["claude-code"]}')
      writeFileSync(join(out, 'framework.config.json'), '{"harnesses":["codex"]}')
      migrateConfigName(out)
      expect(readFileSync(join(out, 'aef.config.json'), 'utf8')).toBe('{"harnesses":["claude-code"]}')
      expect(existsSync(join(out, 'framework.config.json'))).toBe(true)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('is a no-op when neither file exists', () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-migrate-'))
    try {
      expect(() => migrateConfigName(out)).not.toThrow()
      expect(existsSync(join(out, 'aef.config.json'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})

describe('runInit conventions', () => {
  test('framework tier active: outbox is written', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-'))
    const base = JSON.parse(readFileSync(join(ROOT, 'aef.config.example.json'), 'utf8'))
    const cfgPath = join(out, 'aef.config.json')
    writeFileSync(cfgPath, JSON.stringify({ ...base, tiers: ['framework'] }, null, 2))
    try {
      await runInit({ config: cfgPath, out })
      expect(existsSync(join(out, '.ai', 'framework-feedback'))).toBe(true)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })

  test('framework tier absent: outbox is not written', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-'))
    try {
      await runInit({ config: join(ROOT, 'aef.config.example.json'), out })
      expect(existsSync(join(out, '.ai', 'framework-feedback'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
