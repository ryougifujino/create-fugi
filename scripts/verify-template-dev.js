import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '..')
const templatesDir = path.join(repoRoot, 'templates')
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const continueKey = 'c'
const quitKey = 'q'
const stopTimeoutMs = 5_000
const killTimeoutMs = 2_000
const dryRunEnabled = process.argv.includes('--dry-run')

async function main() {
  const templates = await listTemplates()
  const runnableTemplates = []
  const skippedTemplates = []

  for (const template of templates) {
    const packageJsonPath = path.join(template.absolutePath, 'package.json')
    const packageJson = await readPackageJson(packageJsonPath)
    const devCommand = readDevCommand(packageJson)

    if (devCommand === null) {
      skippedTemplates.push(template.name)
      continue
    }

    runnableTemplates.push({
      ...template,
      devCommand,
    })
  }

  if (runnableTemplates.length === 0) {
    throw new Error(`No template package.json with a dev script was found under ${relativeToRepo(templatesDir)}.`)
  }

  log('')
  log(`Template dev review order (${runnableTemplates.length} templates):`)
  for (const [index, template] of runnableTemplates.entries()) {
    log(`${index + 1}. ${template.name} -> ${template.devCommand}`)
  }

  if (skippedTemplates.length > 0) {
    log('')
    log(`Skipped templates without a root dev script: ${skippedTemplates.join(', ')}`)
  }

  if (dryRunEnabled) {
    log('')
    log('Dry run only. No pnpm dev command was started.')
    return
  }

  const restoreKeyboard = setupKeyboard()
  const reviewedTemplates = []

  try {
    for (const [index, template] of runnableTemplates.entries()) {
      const result = await reviewTemplate(template, index, runnableTemplates.length)
      reviewedTemplates.push(result)

      if (result.status === 'quit') {
        break
      }
    }
  } finally {
    restoreKeyboard()
  }

  log('')
  log('Review summary:')
  for (const item of reviewedTemplates) {
    log(`- ${item.templateName}: ${item.statusLabel}`)
  }

  if (skippedTemplates.length > 0) {
    log(`- skipped: ${skippedTemplates.join(', ')}`)
  }
}

async function listTemplates() {
  const entries = await readdir(templatesDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(templatesDir, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function readPackageJson(packageJsonPath) {
  const packageJsonContent = await readFile(packageJsonPath, 'utf-8')

  return JSON.parse(packageJsonContent)
}

function readDevCommand(packageJson) {
  const scripts = packageJson?.scripts

  if (scripts === null || typeof scripts !== 'object') {
    return null
  }

  return typeof scripts.dev === 'string' && scripts.dev.trim() !== '' ? scripts.dev.trim() : null
}

function setupKeyboard() {
  if (!process.stdin.isTTY) {
    throw new Error('verify-template-dev requires an interactive TTY so it can listen for key presses.')
  }

  readline.emitKeypressEvents(process.stdin)

  const wasRaw = process.stdin.isRaw === true

  process.stdin.setRawMode(true)
  process.stdin.resume()

  return () => {
    if (!wasRaw) {
      process.stdin.setRawMode(false)
    }

    process.stdin.pause()
  }
}

async function reviewTemplate(template, index, total) {
  log('')
  log('='.repeat(72))
  log(`[${index + 1}/${total}] ${template.name}`)
  log(`cwd: ${relativeToRepo(template.absolutePath)}`)
  log(`command: pnpm dev`)
  log(`controls: "${continueKey}" = stop current dev and continue, "${quitKey}" = quit review, Ctrl+C = abort`)
  log('='.repeat(72))

  const childProcess = spawn(pnpmCommand, ['dev'], {
    cwd: template.absolutePath,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  })

  childProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(chunk)
  })

  childProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(chunk)
  })

  const exitPromise = waitForChildExit(childProcess)
  const actionWaiter = createActionWaiter(
    `Watching ${template.name}. Press "${continueKey}" when you want to stop it and move on.`,
  )

  const firstResult = await Promise.race([
    exitPromise.then((exit) => ({ type: 'exit', exit })),
    actionWaiter.promise.then((action) => ({ type: 'action', action })),
  ])

  actionWaiter.cancel()

  if (firstResult.type === 'action') {
    if (firstResult.action === 'abort') {
      await stopChildProcess(childProcess, exitPromise)
      throw createAbortError()
    }

    if (firstResult.action === 'quit') {
      await stopChildProcess(childProcess, exitPromise)

      return {
        templateName: template.name,
        status: 'quit',
        statusLabel: 'quit by user',
      }
    }

    log('')
    log(`Stopping ${template.name} and continuing to the next template...`)
    await stopChildProcess(childProcess, exitPromise)

    return {
      templateName: template.name,
      status: 'continued',
      statusLabel: 'stopped by keypress and continued',
    }
  }

  log('')
  log(`${template.name} exited ${formatExit(firstResult.exit)}.`)

  const nextActionWaiter = createActionWaiter(
    `Press "${continueKey}" to continue to the next template, or "${quitKey}" to stop the review here.`,
  )
  const nextAction = await nextActionWaiter.promise
  nextActionWaiter.cancel()

  if (nextAction === 'abort') {
    throw createAbortError()
  }

  if (nextAction === 'quit') {
    return {
      templateName: template.name,
      status: 'quit',
      statusLabel: `process exited ${formatExit(firstResult.exit)}, then user quit`,
    }
  }

  return {
    templateName: template.name,
    status: 'exited',
    statusLabel: `process exited ${formatExit(firstResult.exit)}, then continued`,
  }
}

function createActionWaiter(promptMessage) {
  log(promptMessage)

  let active = true
  let onKeypress = null

  const promise = new Promise((resolve) => {
    onKeypress = (str, key) => {
      if (!active) {
        return
      }

      if (key?.ctrl === true && key.name === 'c') {
        active = false
        process.stdin.off('keypress', onKeypress)
        resolve('abort')
        return
      }

      const pressedKey =
        typeof key?.name === 'string' && key.name !== '' ? key.name : typeof str === 'string' ? str : ''
      const normalizedKey = pressedKey.toLowerCase()

      if (normalizedKey === continueKey) {
        active = false
        process.stdin.off('keypress', onKeypress)
        resolve('continue')
        return
      }

      if (normalizedKey === quitKey) {
        active = false
        process.stdin.off('keypress', onKeypress)
        resolve('quit')
      }
    }

    process.stdin.on('keypress', onKeypress)
  })

  return {
    promise,
    cancel() {
      active = false

      if (onKeypress !== null) {
        process.stdin.off('keypress', onKeypress)
      }
    },
  }
}

function waitForChildExit(childProcess) {
  return new Promise((resolve, reject) => {
    childProcess.once('error', reject)
    childProcess.once('exit', (code, signal) => {
      resolve({ code, signal })
    })
  })
}

async function stopChildProcess(childProcess, exitPromise) {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return exitPromise
  }

  sendSignal(childProcess, 'SIGINT')

  const gracefulExit = await raceWithTimeout(exitPromise, stopTimeoutMs)
  if (gracefulExit !== null) {
    return gracefulExit
  }

  log(`Process did not exit within ${stopTimeoutMs / 1000}s. Sending SIGKILL...`)
  sendSignal(childProcess, 'SIGKILL')

  const forcedExit = await raceWithTimeout(exitPromise, killTimeoutMs)
  if (forcedExit !== null) {
    return forcedExit
  }

  throw new Error('Failed to stop pnpm dev after SIGINT and SIGKILL.')
}

function sendSignal(childProcess, signal) {
  try {
    if (process.platform !== 'win32' && typeof childProcess.pid === 'number') {
      process.kill(-childProcess.pid, signal)
      return
    }

    childProcess.kill(signal)
  } catch (error) {
    if (error?.code !== 'ESRCH') {
      throw error
    }
  }
}

async function raceWithTimeout(promise, timeoutMs) {
  let timeoutId

  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

function formatExit(exit) {
  if (exit.signal !== null) {
    return `with signal ${exit.signal}`
  }

  return `with exit code ${exit.code ?? 0}`
}

function relativeToRepo(targetPath) {
  return path.relative(repoRoot, targetPath) || '.'
}

function log(message) {
  process.stdout.write(`${message}\n`)
}

function createAbortError() {
  const error = new Error('Template dev review aborted by user.')
  error.name = 'AbortError'
  return error
}

try {
  await main()
} catch (error) {
  if (error instanceof Error && error.name === 'AbortError') {
    process.exitCode = 130
  } else {
    process.exitCode = 1
  }

  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`)
  } else {
    process.stderr.write(`Unexpected error: ${String(error)}\n`)
  }
}
