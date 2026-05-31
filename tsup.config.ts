import { defineConfig } from 'tsup'

// Ship two entries: the library (re-exports the pure core) and the CLI bin.
// The `#!/usr/bin/env node` shebang at the top of src/cli/index.ts is preserved
// by esbuild, so the built dist/cli/index.js is directly executable.
export default defineConfig({
  entry: { index: 'src/index.ts', 'cli/index': 'src/cli/index.ts' },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  clean: true,
  sourcemap: true,
})
