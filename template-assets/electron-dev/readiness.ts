import { access, stat } from 'node:fs/promises'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

interface PortSearchOptions {
  host: string
  startPort: number
  searchLimit: number
}

async function canUsePort(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()

    server.once('error', () => {
      resolve(false)
    })

    server.listen(port, host, () => {
      server.close(() => {
        resolve(true)
      })
    })
  })
}

export async function findAvailablePort({ host, startPort, searchLimit }: PortSearchOptions) {
  for (let port = startPort; port < startPort + searchLimit; port += 1) {
    if (await canUsePort(host, port)) {
      return port
    }
  }

  throw new Error(`Unable to find a free port between ${startPort} and ${startPort + searchLimit - 1}.`)
}

export async function waitForDevServer(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      await fetch(url)
      return
    } catch {
      await delay(100)
    }
  }

  throw new Error(`Timed out waiting for the renderer dev server at ${url}.`)
}

export async function waitForFile(filePath: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      await access(filePath)
      const fileStats = await stat(filePath)

      if (fileStats.isFile()) {
        return fileStats
      }
    } catch {
      await delay(100)
    }
  }

  throw new Error(`Timed out waiting for the file at ${filePath}.`)
}
