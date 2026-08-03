#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { runCreateCommand } from './commands/create.ts'

export const HELP_TEXT = `Usage:
  create-fugi [project-name] [options]
  pnpm create fugi [project-name] [options]

Options:
  -t, --template <name>  Scaffold with the given template without prompting
  -h, --help             Show this help message
  -v, --version          Show the CLI version`

export interface CreateCliOptions {
  projectName?: string
  templateName?: string
}

export interface CliDependencies {
  runCreateCommand?: (options: CreateCliOptions) => Promise<void>
  writeStdout?: (message: string) => void
  readVersion?: () => Promise<string>
}

export const SIGINT_EXIT_CODE = 130

export function isExitPromptError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ExitPromptError'
}

async function readCliVersion(): Promise<string> {
  const packageJsonPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as { version: string }
  return packageJson.version
}

export async function runCli(argv: string[], dependencies: CliDependencies = {}): Promise<number> {
  const writeStdout = dependencies.writeStdout ?? console.log

  let values: { template?: string; help?: boolean; version?: boolean }
  let positionals: string[]
  try {
    ;({ values, positionals } = parseArgs({
      args: argv,
      options: {
        template: { type: 'string', short: 't' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    }))
  } catch {
    writeStdout(HELP_TEXT)
    return 1
  }

  if (values.help === true) {
    writeStdout(HELP_TEXT)
    return 0
  }

  if (values.version === true) {
    writeStdout(await (dependencies.readVersion ?? readCliVersion)())
    return 0
  }

  const projectNameArgs = positionals[0] === 'create' ? positionals.slice(1) : positionals

  if (projectNameArgs.length > 1) {
    writeStdout(HELP_TEXT)
    return 1
  }

  await (dependencies.runCreateCommand ?? runCreateCommand)({
    projectName: projectNameArgs[0],
    templateName: values.template,
  })
  return 0
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
