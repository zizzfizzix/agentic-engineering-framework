#!/usr/bin/env node
// agentic — CLI for the extracted engineering framework.
//
//   agentic init [--config <cfg>] [--out <dir>] [--copy] [--interactive]
//   agentic sync [--out <dir>]
//   agentic dev
import { Command } from 'commander'
import { ZodError } from 'zod'
import { runInit } from './commands/init.js'
import { runSync } from './commands/sync.js'
import { runDev } from './commands/dev.js'
import { runRender } from './commands/render.js'

const program = new Command()

program
  .name('agentic')
  .description('Render slot-based engineering skills into a consumer repo and keep them in sync.')
  .version('0.1.0')

program
  .command('init')
  .description('Render the configured skill set into a consumer repo and wire harnesses.')
  .option('--config <path>', 'path to framework.config.json (defaults to the bundled example)')
  .option('--out <dir>', 'consumer directory to write into')
  .option('--copy', 'copy rendered skills into harness dirs instead of symlinking')
  .option('-i, --interactive', 'build the config interactively via prompts')
  .action((opts) => runInit(opts))

program
  .command('render')
  .description('Render a single skill to stdout (or --out <dir>) for inspection.')
  .requiredOption('--skill <name>', 'skill id to render')
  .option('--config <path>', 'path to framework.config.json (defaults to the bundled example)')
  .option('--out <dir>', 'write SKILL.md + provenance.json under <dir>/<skill>/ instead of stdout')
  .action((opts) => runRender(opts))

program
  .command('sync')
  .description('Re-render from framework source and reconcile with local edits (3-way merge).')
  .option('--out <dir>', 'consumer directory to sync')
  .action((opts) => runSync(opts))

program
  .command('dev')
  .description('Meta-install: wire this repo’s harness dirs to dev/ skills for framework development.')
  .action(() => runDev())

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ZodError) {
    console.error('Invalid configuration:')
    for (const issue of err.issues) console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  } else {
    console.error(err instanceof Error ? err.message : String(err))
  }
  process.exit(1)
})
