#!/usr/bin/env node
// aef — CLI for the Agentic Engineering Framework.
//
//   aef init [--config <cfg>] [--out <dir>] [--copy] [--interactive]
//   aef sync [--out <dir>]
//   aef add <adapter> [--out <dir>] [--copy]
//   aef remove <adapter> [--out <dir>] [--copy]
//   aef dev
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { ZodError, ZodIssueCode } from 'zod'
import { runInit } from './commands/init.js'
import { runSync } from './commands/sync.js'
import { runDev } from './commands/dev.js'
import { runRender } from './commands/render.js'
import { runAdd, runRemove } from './commands/adapter.js'
import { FrameworkConfigSchema } from '../core/contracts.js'

// Single source of truth for the version: read the package's own package.json at
// runtime so it never drifts from release-please's bump (dev: src/cli/, built:
// dist/cli/ — both resolve to the package root).
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]!
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, temp, dp[j - 1]!)
      prev = temp
    }
  }
  return dp[b.length]!
}

function suggestKey(unknown: string, valid: string[]): string | null {
  let best: string | null = null
  let bestDist = Infinity
  for (const k of valid) {
    const d = levenshtein(unknown, k)
    if (d < bestDist) {
      bestDist = d
      best = k
    }
  }
  return bestDist / Math.max(unknown.length, best!.length) <= 0.4 ? best : null
}

const program = new Command()

program
  .name('aef')
  .description('Render slot-based engineering skills into a consumer repo and keep them in sync.')
  .version(version)

program
  .command('init')
  .description('Render the configured skill set into a consumer repo and wire harnesses.')
  .option('--config <path>', 'path to framework.config.json (required unless --interactive)')
  .option('--out <dir>', 'consumer directory to write into')
  .option('--copy', 'copy rendered skills into harness dirs instead of symlinking')
  .option('-i, --interactive', 'build the config interactively via prompts')
  .action((opts) => runInit(opts))

program
  .command('render')
  .description('Render a single skill to stdout (or --out <dir>) for inspection.')
  .requiredOption('--skill <name>', 'skill id to render')
  .option('--config <path>', 'path to framework.config.json (required)')
  .option('--out <dir>', 'write SKILL.md + provenance.json under <dir>/<skill>/ instead of stdout')
  .action((opts) => runRender(opts))

program
  .command('sync')
  .description('Re-render from framework source and reconcile with local edits (3-way merge).')
  .option('--out <dir>', 'consumer directory to sync (default: current directory)')
  .action((opts) => runSync(opts))

program
  .command('add')
  .argument('<adapter>', 'adapter name to select (axis inferred from its adapter.json)')
  .description('Select an adapter and reconcile the installed skill set (merges local edits).')
  .option('--out <dir>', 'consumer directory to update')
  .option('--copy', 'copy rendered skills into harness dirs instead of symlinking')
  .action((adapter, opts) => runAdd(adapter, opts))

program
  .command('remove')
  .argument('<adapter>', 'adapter name to deselect (axis inferred from its adapter.json)')
  .description('Deselect an adapter; uninstalls skills that required its axis.')
  .option('--out <dir>', 'consumer directory to update')
  .option('--copy', 'copy rendered skills into harness dirs instead of symlinking')
  .action((adapter, opts) => runRemove(adapter, opts))

program
  .command('dev')
  .description('Meta-install: wire this repo’s harness dirs to dev/ skills for framework development.')
  .action(() => runDev())

const validRootKeys = Object.keys(FrameworkConfigSchema.shape)

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ZodError) {
    console.error('Invalid configuration:')
    for (const issue of err.issues) {
      if (issue.code === ZodIssueCode.unrecognized_keys && issue.path.length === 0) {
        for (const key of issue.keys) {
          const suggestion = suggestKey(key, validRootKeys)
          const hint = suggestion != null ? ` Did you mean '${suggestion}'?` : ''
          console.error(`  - Unknown key '${key}'.${hint}`)
        }
        console.error(`    Valid keys: ${validRootKeys.join(', ')}`)
      } else {
        console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      }
    }
  } else {
    console.error(err instanceof Error ? err.message : String(err))
  }
  process.exit(1)
})
