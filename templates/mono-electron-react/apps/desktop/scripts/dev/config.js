import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const devServerHost = 'localhost'
export const firstDevServerPort = 5173
export const portSearchLimit = 20
export const waitTimeoutMs = 30_000
export const electronEntryWatchIntervalMs = 250
export const electronShutdownGraceMs = 5_000

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const appDir = path.resolve(currentDir, '..', '..')
export const electronEntryPath = path.join(appDir, 'dist', 'main', 'main.mjs')
export const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
