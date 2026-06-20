// Unit tests for `aef init` error handling and tier-gated conventions.
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, describe } from 'vitest'
import { runInit } from '../src/cli/commands/init.js'

const ROOT = process.cwd()

describe('runInit error handling', () => {
  test('throws a helpful error when --config is omitted and not interactive', async () => {
    await expect(runInit({})).rejects.toThrow('--config is required.')
  })

  test('error message includes usage example', async () => {
    await expect(runInit({})).rejects.toThrow('aef init --config framework.config.json --out . --copy')
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
    const cfgPath = join(ROOT, 'framework.config.example.json')
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
    const cfgPath = join(ROOT, 'framework.config.example.json')
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
    const cfgPath = join(ROOT, 'framework.config.example.json')
    try {
      await expect(runInit({ config: cfgPath, out })).resolves.toBeUndefined()
      expect(existsSync(join(out, 'package.json'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})

describe('runInit conventions', () => {
  test('framework tier active: outbox is written', async () => {
    const out = mkdtempSync(join(tmpdir(), 'agentic-init-'))
    const base = JSON.parse(readFileSync(join(ROOT, 'framework.config.example.json'), 'utf8'))
    const cfgPath = join(out, 'framework.config.json')
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
      await runInit({ config: join(ROOT, 'framework.config.example.json'), out })
      expect(existsSync(join(out, '.ai', 'framework-feedback'))).toBe(false)
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
