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
