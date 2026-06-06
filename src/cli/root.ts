import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The framework SOURCE root (where core/, adapters/, schemas/ live). Resolves the
// same whether running from src/cli/ via tsx or from dist/cli/ after a build —
// both are two levels below the package root.
export const FRAMEWORK_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
