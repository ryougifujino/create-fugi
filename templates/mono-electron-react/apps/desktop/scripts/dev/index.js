import process from 'node:process'
import {
  appDir,
  devServerHost,
  electronEntryPath,
  electronEntryWatchIntervalMs,
  electronShutdownGraceMs,
  firstDevServerPort,
  pnpmCommand,
  portSearchLimit,
  waitTimeoutMs,
} from './config.js'
import { ElectronController } from './electron-controller.js'
import { log, logFailure } from './logger.js'
import { ProcessSupervisor } from './process-supervisor.js'
import { findAvailablePort, waitForDevServer, waitForFile } from './readiness.js'

let exitPromise = null

function resolveExitCode(cause) {
  return typeof cause === 'number' ? cause : 1
}

function fail(message, cause) {
  logFailure(message, cause)
  void shutdown(resolveExitCode(cause))
}

const supervisor = new ProcessSupervisor({
  cwd: appDir,
  onUnexpectedExit: fail,
  pnpmCommand,
})

const electronController = new ElectronController({
  appDir,
  electronEntryPath,
  electronEntryWatchIntervalMs,
  electronShutdownGraceMs,
  log,
  onStopped: () => {
    void shutdown(0)
  },
  onUnexpectedExit: fail,
  pnpmCommand,
  supervisor,
})

async function shutdown(exitCode) {
  if (exitPromise !== null) {
    return exitPromise
  }

  electronController.stopWatching()
  exitPromise = supervisor.stopAll().then(() => {
    process.exit(exitCode)
  })

  return exitPromise
}

async function main() {
  const rendererPort = await findAvailablePort({
    host: devServerHost,
    searchLimit: portSearchLimit,
    startPort: firstDevServerPort,
  })
  const devServerUrl = `http://${devServerHost}:${rendererPort}`

  electronController.setDevServerUrl(devServerUrl)

  log(`Starting renderer on ${devServerUrl}.`)
  supervisor.spawnPnpmCommand(
    ['exec', 'vite', '--host', devServerHost, '--port', `${rendererPort}`, '--strictPort', '--clearScreen', 'false'],
    'renderer dev server',
  )

  log('Watching Electron bundle with tsdown.')
  supervisor.spawnPnpmCommand(['exec', 'tsdown', '--watch'], 'Electron bundle watcher')

  const [electronEntryStats] = await Promise.all([
    waitForFile(electronEntryPath, waitTimeoutMs),
    waitForDevServer(devServerUrl, waitTimeoutMs),
  ])
  electronController.setElectronEntryMtime(electronEntryStats.mtimeMs)
  electronController.watchElectronEntry()

  log('Renderer and Electron bundle are ready. Launching Electron.')
  electronController.start()
}

process.on('SIGINT', () => {
  void shutdown(0)
})

process.on('SIGTERM', () => {
  void shutdown(0)
})

void main().catch((error) => {
  fail('Dev workflow failed.', error)
})
