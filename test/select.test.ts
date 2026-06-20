// Unit tests for selectSkills: tier resolution, requires-axis filtering, deduplication.
import { test, expect, describe } from 'vitest'
import { selectSkills } from '../src/core/select.js'
import type { FrameworkConfig } from '../src/core/contracts.js'

const ROOT = process.cwd()

const cfg = (partial: Partial<Omit<FrameworkConfig, 'harnesses'>> = {}): FrameworkConfig => ({
  harnesses: ['claude-code'],
  ...partial,
})

describe('selectSkills', () => {
  test('default tier skills are always included', () => {
    const { skills } = selectSkills(ROOT, cfg())
    expect(skills).toContain('code-review')
    expect(skills).toContain('check-and-commit')
  })

  test('opt-in tier skills are excluded without the tier', () => {
    const { skills } = selectSkills(ROOT, cfg())
    expect(skills).not.toContain('improve-framework')
  })

  test('opt-in tier skills are included when the tier is active', () => {
    const { skills } = selectSkills(ROOT, cfg({ tiers: ['framework'] }))
    expect(skills).toContain('improve-framework')
  })

  test('skill with required axis is skipped when axis not configured', () => {
    const { skills, skipped } = selectSkills(ROOT, cfg())
    expect(skills).not.toContain('migrate-orm')
    expect(skipped.some((s) => s.startsWith('migrate-orm'))).toBe(true)
  })

  test('skill with required axis is included when axis is configured', () => {
    const { skills, skipped } = selectSkills(ROOT, cfg({ orm: 'drizzle' }))
    expect(skills).toContain('migrate-orm')
    expect(skipped.some((s) => s.startsWith('migrate-orm'))).toBe(false)
  })

  test('unknown tier name appears in skipped', () => {
    const { skipped } = selectSkills(ROOT, cfg({ tiers: ['nonexistent-tier'] }))
    expect(skipped.some((s) => s.includes('nonexistent-tier'))).toBe(true)
  })

  test('output skills are sorted alphabetically', () => {
    const { skills } = selectSkills(ROOT, cfg({ orm: 'drizzle', ui: 'shadcn' }))
    expect(skills).toEqual([...skills].sort())
  })

  test('no duplicate skills even when a skill could appear in multiple tiers', () => {
    const { skills } = selectSkills(ROOT, cfg({ tiers: ['framework'] }))
    expect(skills.length).toBe(new Set(skills).size)
  })
})
