// Regenerate the published JSON Schemas from the zod contracts (the source of truth).
// Run via `pnpm schemas` whenever src/core/contracts.ts changes.
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodTypeAny } from 'zod'
import { FrameworkConfigSchema, AdapterSchema } from '../src/core/contracts.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://github.com/zizzfizzix/agentic-engineering-framework/schemas'

function emit(schema: ZodTypeAny, file: string, title: string, description: string): void {
  const generated = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >
  delete generated.$schema // replaced by the 2020-12 header below
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${BASE}/${file}`,
    title,
    description,
    ...generated,
  }
  writeFileSync(join(ROOT, 'schemas', file), JSON.stringify(doc, null, 2) + '\n')
  console.log(`  wrote schemas/${file}`)
}

console.log('Generating JSON Schemas from zod contracts:')
emit(
  FrameworkConfigSchema,
  'aef.config.schema.json',
  'aef.config.json',
  'Per-consumer configuration the renderer, init/sync, and skills all read. One axis selection per family; init resolves these into a converged skill set.',
)
emit(
  AdapterSchema,
  'adapter.schema.json',
  'adapter.json',
  'An adapter declares which skills it augments and the slot content it provides. The renderer fills matching slots in generic skill bodies and prunes the rest.',
)
