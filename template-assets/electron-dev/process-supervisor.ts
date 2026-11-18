import { spawn, type ChildProcess } from 'node:child_process'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'

export type UnexpectedExitHandler = (message: string, cause: Error | number) => void

interface ProcessSupervisorOptions {
  cwd: string
  onUnexpectedExit: UnexpectedExitHandler
  pnpmCommand: string
}

export class ProcessSupervisor {
  #childProcesses = new Set<ChildProcess>()
  #cwd
  #onUnexpectedExit
  #pnpmCommand
  #shuttingDown = false
  #stopPromise: Promise<void> | null = null

  constructor({ cwd, onUnexpectedExit, pnpmCommand }: ProcessSupervisorOptions) {
    this.#cwd = cwd
    this.#onUnexpectedExit = onUnexpectedExit
    this.#pnpmCommand = pnpmCommand
  }

  get isShuttingDown() {
    return this.#shuttingDown
  }

  register(childProcess: ChildProcess) {
    this.#childProcesses.add(childProcess)
    return childProcess
  }

  unregister(childProcess: ChildProcess) {
    this.#childProcesses.delete(childProcess)
  }

  spawnPnpmCommand(args: string[], name: string, env: NodeJS.ProcessEnv = {}) {
    const childProcess = spawn(this.#pnpmCommand, args, {
      cwd: this.#cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
      },
    })

    this.register(childProcess)
    this.#attachLifecycle(childProcess, name)
    return childProcess
  }

  async stopAll() {
    if (this.#stopPromise !== null) {
      return this.#stopPromise
    }

    this.#shuttingDown = true
    this.#stopPromise = (async () => {
      for (const childProcess of Array.from(this.#childProcesses)) {
        childProcess.kill('SIGTERM')
      }

      await delay(150)

      for (const childProcess of Array.from(this.#childProcesses)) {
        if (!childProcess.killed) {
          childProcess.kill('SIGKILL')
        }
      }
    })()

    return this.#stopPromise
  }

  #attachLifecycle(childProcess: ChildProcess, name: string) {
    childProcess.on('error', (error) => {
      this.#onUnexpectedExit(`Failed to start ${name}.`, error)
    })

    childProcess.on('exit', (code, signal) => {
      this.unregister(childProcess)

      if (this.#shuttingDown || signal === 'SIGTERM') {
        return
      }

      this.#onUnexpectedExit(`${name} exited unexpectedly.`, code ?? 1)
    })
  }
}
