import { test, expect, describe } from 'vitest'
import { renderSkill, SLOT_OPEN, SLOT_ANY } from '../bin/lib/render-skill.mjs'

const ROOT = process.cwd()
const hasSlotLine = (text) => text.split('\n').some((l) => SLOT_ANY.test(l))

describe('convergence', () => {
  test('selected ORM adapter content appears; others do not', () => {
    const dz = renderSkill(ROOT, { orm: 'drizzle' }, 'migrate-orm').rendered
    expect(dz).toMatch(/Drizzle/)
    expect(dz).not.toMatch(/MikroORM/)

    const mk = renderSkill(ROOT, { orm: 'mikro-orm' }, 'migrate-orm').rendered
    expect(mk).toMatch(/MikroORM/)
    expect(mk).not.toMatch(/Drizzle/)
  })

  test('unselected axis prunes its slots entirely (no markers, no content)', () => {
    const none = renderSkill(ROOT, {}, 'migrate-orm').rendered
    expect(hasSlotLine(none)).toBe(false)
    expect(none).not.toMatch(/Drizzle|MikroORM/)
  })

  test('an active adapter that omits a slot still gets it pruned (heterogeneity)', () => {
    const shadcn = renderSkill(ROOT, { ui: 'shadcn' }, 'ui-consistency').rendered
    expect(shadcn).not.toMatch(/Health check/) // shadcn ships no health-check fragment
    expect(hasSlotLine(shadcn)).toBe(false)

    const omui = renderSkill(ROOT, { ui: 'open-mercato-ui' }, 'ui-consistency').rendered
    expect(omui).toMatch(/Health check/) // open-mercato-ui does
  })
})

describe('determinism', () => {
  test('identical inputs produce identical bytes and digest', () => {
    const a = renderSkill(ROOT, { orm: 'drizzle', ui: 'shadcn' }, 'migrate-orm')
    const b = renderSkill(ROOT, { orm: 'drizzle', ui: 'shadcn' }, 'migrate-orm')
    expect(a.rendered).toBe(b.rendered)
    expect(a.digest).toBe(b.digest)
  })

  test('digest is scoped per-skill: an unrelated axis change does not perturb it', () => {
    const noUi = renderSkill(ROOT, { orm: 'drizzle' }, 'migrate-orm').digest
    const withUi = renderSkill(ROOT, { orm: 'drizzle', ui: 'shadcn' }, 'migrate-orm').digest
    expect(noUi).toBe(withUi)
  })
})

describe('provenance', () => {
  test('regions are contiguous, cover the whole body, and map slots to adapter files', () => {
    const { rendered, manifest } = renderSkill(ROOT, { orm: 'drizzle' }, 'migrate-orm')
    const bodyLines = rendered.split('\n').length - 1 /* trailing newline */ - 2 /* header + blank */

    // contiguous and complete
    let expected = 1
    for (const r of manifest.regions) {
      expect(r.startLine).toBe(expected)
      expect(r.endLine).toBeGreaterThanOrEqual(r.startLine)
      expected = r.endLine + 1
    }
    expect(manifest.regions.at(-1).endLine).toBe(bodyLines)

    // slot regions point at the selected adapter's fragment
    const slotRegions = manifest.regions.filter((r) => r.slot)
    expect(slotRegions.length).toBeGreaterThan(0)
    for (const r of slotRegions) {
      expect(r.adapter).toBe('drizzle')
      expect(r.source).toMatch(/^adapters\/orm\/drizzle\//)
    }
  })
})

describe('slot definition (shared by renderer + gate)', () => {
  test('a marker alone on its own line is a slot', () => {
    expect(SLOT_OPEN.test('<!-- SLOT:orm.cheatsheet -->')).toBe(true)
    expect(SLOT_ANY.test('<!-- /SLOT:orm.cheatsheet -->')).toBe(true)
  })

  test('SLOT mentioned in prose / backticks is NOT a slot', () => {
    expect(SLOT_ANY.test('add a `<!-- SLOT:orm.cheatsheet -->` to the body')).toBe(false)
    expect(SLOT_OPEN.test('  <!-- SLOT:orm.cheatsheet -->')).toBe(false) // indented = prose
  })
})
