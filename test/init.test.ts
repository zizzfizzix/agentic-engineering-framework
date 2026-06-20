// Unit tests for `aef init` error handling.
import { test, expect, describe } from 'vitest'
import { runInit } from '../src/cli/commands/init.js'

describe('runInit error handling', () => {
  test('throws a helpful error when --config is omitted and not interactive', async () => {
    await expect(runInit({})).rejects.toThrow('--config is required.')
  })

  test('error message includes usage example', async () => {
    await expect(runInit({})).rejects.toThrow('aef init --config framework.config.json --out . --copy')
  })

  test('error message includes minimum config snippet', async () => {
    await expect(runInit({})).rejects.toThrow('"harnesses": ["claude-code"]')
  })

  test('error message includes --help pointer', async () => {
    await expect(runInit({})).rejects.toThrow("'aef init --help'")
  })
})
