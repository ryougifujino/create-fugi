import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const executable = process.platform === 'win32' ? 'server.exe' : 'server'
const path = fileURLToPath(new URL(`./dist/api/${executable}`, import.meta.url))
const result = spawnSync(path, { stdio: 'inherit' })

if (result.error) {
  console.error(result.error.message)
}

process.exitCode = result.status ?? 1
