import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { hello } from './commands/hello.ts'

const { name, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  name: string
  version: string
}

const help = `Usage: ${name} <command> [options]

Commands:
  hello [name]   Print a greeting

Options:
  -h, --help     Show this help message
  -v, --version  Show the CLI version`

interface CliOutput {
  stdout: (message: string) => void
  stderr: (message: string) => void
}

export function runCli(argv: string[], output: CliOutput = { stdout: console.log, stderr: console.error }): number {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
    })
  } catch (error) {
    output.stderr(error instanceof Error ? error.message : String(error))
    return 1
  }

  const { values, positionals } = parsed
  const [command, argument, ...extraArguments] = positionals

  if (values.help) {
    output.stdout(help)
    return 0
  }

  if (values.version) {
    output.stdout(version)
    return 0
  }

  if (command === undefined) {
    output.stdout(help)
    return 0
  }

  if (command !== 'hello') {
    output.stderr(`Unknown command "${command}". Run ${name} --help for usage.`)
    return 1
  }

  if (extraArguments.length > 0) {
    output.stderr(`Usage: ${name} hello [name]`)
    return 1
  }

  output.stdout(hello(argument))
  return 0
}
