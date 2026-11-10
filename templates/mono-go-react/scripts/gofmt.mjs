import { spawnSync } from 'node:child_process'
import { globSync } from 'node:fs'

const check = process.argv.includes('--check')
const files = globSync('**/*.go', { exclude: ['**/dist', '**/node_modules', '**/vendor'] })

if (files.length > 0) {
  const result = spawnSync('gofmt', [check ? '-l' : '-w', ...files], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })

  if (result.error) {
    console.error(result.error.message)
  }
  if (result.stdout) {
    process.stdout.write(result.stdout)
  }

  const hasUnformattedFiles = check && Boolean(result.stdout)
  process.exitCode = (result.status ?? 1) || Number(hasUnformattedFiles)
}
