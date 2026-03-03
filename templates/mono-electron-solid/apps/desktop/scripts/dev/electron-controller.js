import { spawn } from 'node:child_process'
import { unwatchFile, watchFile } from 'node:fs'
import process from 'node:process'

export class ElectronController {
  #appDir
  #devServerUrl = ''
  #electronEntryPath
  #electronEntryWatchIntervalMs
  #electronProcess = null
  #electronShutdownGraceMs
  #log
  #onStopped
  #onUnexpectedExit
  #pnpmCommand
  #restartAfterExit = false
  #restartTimer = null
  #supervisor
  #lastKnownElectronEntryMtimeMs = 0

  constructor({
    appDir,
    electronEntryPath,
    electronEntryWatchIntervalMs,
    electronShutdownGraceMs,
    log,
    onStopped,
    onUnexpectedExit,
    pnpmCommand,
    supervisor,
  }) {
    this.#appDir = appDir
    this.#electronEntryPath = electronEntryPath
    this.#electronEntryWatchIntervalMs = electronEntryWatchIntervalMs
    this.#electronShutdownGraceMs = electronShutdownGraceMs
    this.#log = log
    this.#onStopped = onStopped
    this.#onUnexpectedExit = onUnexpectedExit
    this.#pnpmCommand = pnpmCommand
    this.#supervisor = supervisor
  }

  setDevServerUrl(url) {
    this.#devServerUrl = url
  }

  setElectronEntryMtime(mtimeMs) {
    this.#lastKnownElectronEntryMtimeMs = mtimeMs
  }

  watchElectronEntry() {
    watchFile(this.#electronEntryPath, { interval: this.#electronEntryWatchIntervalMs }, (current) => {
      if (
        this.#supervisor.isShuttingDown ||
        current.mtimeMs === 0 ||
        current.mtimeMs <= this.#lastKnownElectronEntryMtimeMs
      ) {
        return
      }

      this.#lastKnownElectronEntryMtimeMs = current.mtimeMs
      this.#scheduleRestart()
    })
  }

  stopWatching() {
    if (this.#restartTimer !== null) {
      clearTimeout(this.#restartTimer)
      this.#restartTimer = null
    }

    unwatchFile(this.#electronEntryPath)
  }

  start() {
    const childProcess = spawn(this.#pnpmCommand, ['exec', 'electron', '.'], {
      cwd: this.#appDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: this.#devServerUrl,
      },
    })

    this.#electronProcess = childProcess
    this.#supervisor.register(childProcess)

    childProcess.on('error', (error) => {
      this.#onUnexpectedExit('Failed to start Electron.', error)
    })

    childProcess.on('exit', (code, signal) => {
      this.#supervisor.unregister(childProcess)
      this.#handleExit(childProcess, code, signal)
    })
  }

  #handleExit(childProcess, code, signal) {
    const shouldRestart = this.#restartAfterExit
    this.#restartAfterExit = false

    if (this.#electronProcess === childProcess) {
      this.#electronProcess = null
    }

    if (this.#supervisor.isShuttingDown) {
      return
    }

    if (shouldRestart) {
      this.#log('Restarting Electron after bundle rebuild.')
      this.start()
      return
    }

    if (code === 0 || signal === 'SIGTERM') {
      this.#log('Electron exited. Stopping dev workflow.')
      this.#onStopped()
      return
    }

    this.#onUnexpectedExit('Electron exited unexpectedly.', code ?? 1)
  }

  #scheduleRestart() {
    if (this.#supervisor.isShuttingDown || this.#electronProcess === null) {
      return
    }

    if (this.#restartTimer !== null) {
      clearTimeout(this.#restartTimer)
    }

    this.#restartTimer = setTimeout(() => {
      this.#restartTimer = null
      this.#restart()
    }, 150)
  }

  #restart() {
    if (this.#supervisor.isShuttingDown) {
      return
    }

    if (this.#electronProcess === null) {
      this.start()
      return
    }

    if (this.#restartAfterExit) {
      return
    }

    this.#restartAfterExit = true
    this.#electronProcess.kill('SIGTERM')

    const currentElectronProcess = this.#electronProcess

    setTimeout(() => {
      if (this.#restartAfterExit && currentElectronProcess !== null && !currentElectronProcess.killed) {
        currentElectronProcess.kill('SIGKILL')
      }
    }, this.#electronShutdownGraceMs).unref()
  }
}
