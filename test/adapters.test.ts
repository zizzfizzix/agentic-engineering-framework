// Contract tests: every adapter.json on disk validates against the zod AdapterSchema,
// its slot fragments exist and are non-empty, slot names are prefixed by the adapter's
// axis, and harness adapters declare how to wire skills.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, describe } from 'vitest'
import { AdapterSchema } from '../src/core/contracts.js'

const ROOT = process.cwd()
const AXES = ['orm', 'ui', 'stack', 'harness']

interface Found {
  axis: string
  name: string
  dir: string
}

const adapters: Found[] = []
for (const axis of AXES) {
  const dir = join(ROOT, 'adapters', axis)
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (existsSync(join(dir, name, 'adapter.json'))) adapters.push({ axis, name, dir: join(dir, name) })
  }
}

describe('adapter contracts', () => {
  test('at least one adapter was discovered', () => {
    expect(adapters.length).toBeGreaterThan(0)
  })

  test.each(adapters)('$axis/$name is a valid adapter', ({ axis, name, dir }) => {
    const ad = AdapterSchema.parse(JSON.parse(readFileSync(join(dir, 'adapter.json'), 'utf8')))

    expect(ad.axis).toBe(axis)
    expect(ad.name).toBe(name)

    for (const [slot, file] of Object.entries(ad.slots ?? {})) {
      const fp = join(dir, file)
      expect(existsSync(fp), `${slot} -> ${file} does not exist`).toBe(true)
      expect(statSync(fp).size, `${file} is empty`).toBeGreaterThan(0)
      expect(slot.split('.')[0], `slot '${slot}' should be prefixed by axis '${axis}'`).toBe(axis)
    }

    if (axis === 'harness') {
      expect(ad.skillsDir, 'harness adapters must declare skillsDir').toBeTruthy()
      expect(ad.linkBase, 'harness adapters must declare linkBase').toBeTruthy()
    }
  })
})
