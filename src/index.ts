#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { runCreateCommand } from './commands/create.ts'

export const HELP_TEXT = `Usage:
  pnpm create fugi
  create-fugi`

export interface CliDependencies {
  runCreateCommand?: () => Promise<void>
  writeStdout?: (message: string) => void
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const command = argv[0]

  if (command === undefined || command === 'create') {
    await (dependencies.runCreateCommand ?? runCreateCommand)()
    return 0
  }

  ;(dependencies.writeStdout ?? console.log)(HELP_TEXT)
  return 1
}

export const SIGINT_EXIT_CODE = 130

export function isExitPromptError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError'
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function main(): Promise<void> {
  try {
    const exitCode = await runCli(process.argv.slice(2))
    process.exitCode = exitCode
  } catch (error) {
    if (isExitPromptError(error)) {
      process.exitCode = SIGINT_EXIT_CODE
      return
    }

    console.error(formatError(error))
    process.exitCode = 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  void main()
}
