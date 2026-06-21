// Unit tests for the pure buildConfig helper extracted from the interactive wizard.
import { test, expect, describe } from 'vitest'
import { buildConfig, mergeNonPromptedFields, type WizardAnswers } from '../src/cli/wizard.js'
import { FrameworkConfigSchema, type FrameworkConfig } from '../src/core/contracts.js'

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
    expect(config.$schema).toBe('./schemas/aef.config.schema.json')
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

  test('undefined text fields do not crash and omit optional output fields', () => {
    const result = buildConfig({
      ...base,
      sourceRepo: undefined,
      modulesRoot: undefined,
      specsRoot: undefined,
      testsRoot: undefined,
    })
    expect(result.source).toBeUndefined()
    expect(result.paths).toBeUndefined()
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

  test('feedbackMode prompt is reflected in upstream.mode', () => {
    const upstream = (buildConfig({ ...base, feedbackMode: 'prompt' }).feedback as Record<string, unknown>)
      .upstream as Record<string, unknown>
    expect(upstream.mode).toBe('prompt')
  })

  test('defaultBranch is trimmed', () => {
    expect(buildConfig({ ...base, defaultBranch: '  main  ' }).git).toEqual({
      defaultBranch: 'main',
      labels: [],
    })
  })

  test('projectName is trimmed', () => {
    expect(buildConfig({ ...base, projectName: '  my-app  ' }).projectName).toBe('my-app')
  })

  test('stack value is passed through to config', () => {
    expect(buildConfig({ ...base, stack: 'next-js' }).stack).toBe('next-js')
  })

  test('minimal answers pass FrameworkConfigSchema validation', () => {
    expect(() => FrameworkConfigSchema.parse(buildConfig(base))).not.toThrow()
  })

  test('fully populated answers pass FrameworkConfigSchema validation', () => {
    expect(() =>
      FrameworkConfigSchema.parse(
        buildConfig({
          ...base,
          selectedTiers: ['automation'],
          validationCommands: ['pnpm test'],
          sourceRepo: 'git@github.com:org/aef.git',
          modulesRoot: 'src/modules',
          specsRoot: '.ai/specs',
          testsRoot: '.ai/qa/tests',
          feedbackMode: 'prompt',
        }),
      ),
    ).not.toThrow()
  })
})

describe('mergeNonPromptedFields', () => {
  const makeResult = () =>
    buildConfig({
      ...base,
      sourceRepo: 'git@github.com:org/repo.git',
    })

  const existing: FrameworkConfig = {
    harnesses: ['claude-code'],
    git: { defaultBranch: 'main', labels: ['bug', 'feat'] },
    source: { repo: 'git@github.com:org/repo.git', path: '/home/user/aef' },
    feedback: {
      capture: true,
      upstream: {
        mode: 'off',
        channel: 'issue',
        schedule: 'monthly',
        sanitize: false,
        requireHumanApproval: false,
      },
    },
  }

  test('preserves non-empty git.labels from existing config', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, existing)
    expect((result.git as Record<string, unknown>).labels).toEqual(['bug', 'feat'])
  })

  test('leaves git.labels as [] when existing labels are empty', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, { ...existing, git: { defaultBranch: 'main', labels: [] } })
    expect((result.git as Record<string, unknown>).labels).toEqual([])
  })

  test('preserves source.path when result has a source', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, existing)
    expect((result.source as Record<string, unknown>).path).toBe('/home/user/aef')
  })

  test('does not add source.path when result has no source', () => {
    const result = buildConfig(base) // no sourceRepo → no source field
    mergeNonPromptedFields(result, existing)
    expect(result.source).toBeUndefined()
  })

  test('preserves feedback.upstream channel from existing config', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, existing)
    const upstream = (result.feedback as Record<string, unknown>).upstream as Record<string, unknown>
    expect(upstream.channel).toBe('issue')
  })

  test('preserves feedback.upstream schedule from existing config', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, existing)
    const upstream = (result.feedback as Record<string, unknown>).upstream as Record<string, unknown>
    expect(upstream.schedule).toBe('monthly')
  })

  test('preserves feedback.upstream sanitize and requireHumanApproval', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, existing)
    const upstream = (result.feedback as Record<string, unknown>).upstream as Record<string, unknown>
    expect(upstream.sanitize).toBe(false)
    expect(upstream.requireHumanApproval).toBe(false)
  })

  test('does not overwrite the prompted feedbackMode', () => {
    const result = buildConfig({ ...base, feedbackMode: 'prompt' })
    mergeNonPromptedFields(result, existing)
    const upstream = (result.feedback as Record<string, unknown>).upstream as Record<string, unknown>
    // mode comes from the wizard answer, not from existing
    expect(upstream.mode).toBe('prompt')
  })

  test('skips feedback merge when existing has no upstream', () => {
    const result = makeResult()
    mergeNonPromptedFields(result, { ...existing, feedback: { capture: true } })
    const upstream = (result.feedback as Record<string, unknown>).upstream as Record<string, unknown>
    expect(upstream.channel).toBe('pr') // built-in default unchanged
  })
})
