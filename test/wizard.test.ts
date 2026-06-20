// Unit tests for the pure buildConfig helper extracted from the interactive wizard.
import { test, expect, describe } from 'vitest'
import { buildConfig, type WizardAnswers } from '../src/cli/wizard.js'

const base: WizardAnswers = {
  projectName: 'my-app',
  harnesses: ['claude-code'],
  orm: null,
  ui: null,
  stack: null,
  selectedTiers: [],
  validationCommands: [],
  defaultBranch: 'main',
  sourceRepo: '',
  modulesRoot: '',
  specsRoot: '',
  testsRoot: '',
  feedbackMode: 'scheduled-pr',
}

describe('buildConfig', () => {
  test('includes $schema and core identity fields', () => {
    const config = buildConfig(base)
    expect(config.$schema).toBe('./schemas/framework.config.schema.json')
    expect(config.projectName).toBe('my-app')
    expect(config.harnesses).toEqual(['claude-code'])
  })

  test('empty selectedTiers omits tiers field', () => {
    expect(buildConfig({ ...base, selectedTiers: [] }).tiers).toBeUndefined()
  })

  test('non-empty selectedTiers are included', () => {
    expect(buildConfig({ ...base, selectedTiers: ['automation', 'security'] }).tiers).toEqual([
      'automation',
      'security',
    ])
  })

  test('empty validationCommands omits validation field', () => {
    expect(buildConfig({ ...base, validationCommands: [] }).validation).toBeUndefined()
  })

  test('validationCommands are passed through verbatim (no splitting)', () => {
    const cmds = ['pnpm test', "node -e \"require('a'),require('b')\""]
    expect(buildConfig({ ...base, validationCommands: cmds }).validation).toEqual(cmds)
  })

  test('blank sourceRepo omits source field', () => {
    expect(buildConfig({ ...base, sourceRepo: '' }).source).toBeUndefined()
    expect(buildConfig({ ...base, sourceRepo: '   ' }).source).toBeUndefined()
  })

  test('sourceRepo is trimmed and sets path:null', () => {
    expect(buildConfig({ ...base, sourceRepo: '  git@github.com:foo/bar.git  ' }).source).toEqual({
      repo: 'git@github.com:foo/bar.git',
      path: null,
    })
  })

  test('all blank paths omits paths field', () => {
    expect(buildConfig({ ...base, modulesRoot: '', specsRoot: '', testsRoot: '' }).paths).toBeUndefined()
  })

  test('partial paths include only non-blank entries', () => {
    expect(buildConfig({ ...base, specsRoot: '.ai/specs' }).paths).toEqual({ specsRoot: '.ai/specs' })
  })

  test('all three paths included when provided', () => {
    expect(
      buildConfig({ ...base, modulesRoot: 'src/modules', specsRoot: '.ai/specs', testsRoot: '.ai/tests' })
        .paths,
    ).toEqual({ modulesRoot: 'src/modules', specsRoot: '.ai/specs', testsRoot: '.ai/tests' })
  })

  test('path values are trimmed', () => {
    expect(buildConfig({ ...base, specsRoot: '  .ai/specs  ' }).paths).toEqual({ specsRoot: '.ai/specs' })
  })

  test('git always includes defaultBranch and empty labels', () => {
    expect(buildConfig({ ...base, defaultBranch: 'develop' }).git).toEqual({
      defaultBranch: 'develop',
      labels: [],
    })
  })

  test('feedback always present with capture:true', () => {
    const fb = buildConfig(base).feedback as Record<string, unknown>
    expect(fb.capture).toBe(true)
  })

  test('feedbackMode is reflected in upstream.mode', () => {
    const fb = buildConfig({ ...base, feedbackMode: 'off' }).feedback as Record<string, unknown>
    expect((fb.upstream as Record<string, unknown>).mode).toBe('off')
  })

  test('feedback upstream defaults are applied', () => {
    const upstream = (buildConfig(base).feedback as Record<string, unknown>).upstream as Record<
      string,
      unknown
    >
    expect(upstream.channel).toBe('pr')
    expect(upstream.schedule).toBe('weekly')
    expect(upstream.sanitize).toBe(true)
    expect(upstream.requireHumanApproval).toBe(true)
  })
})
