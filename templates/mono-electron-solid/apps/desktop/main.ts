import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow } from 'electron'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rendererIndexPath = path.join(currentDir, '..', 'renderer', 'index.html')

const devServerUrl = process.env.VITE_DEV_SERVER_URL
const verifyProfile = process.env.FUGI_VERIFY_ELECTRON_PROFILE

if (devServerUrl !== undefined && verifyProfile !== undefined) {
  app.setPath('userData', verifyProfile)
  app.commandLine.appendSwitch('remote-debugging-port', '0')
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 640,
  })

  if (devServerUrl !== undefined) {
    if (verifyProfile === undefined) {
      void win.loadURL(devServerUrl)
      return
    }

    // Capture errors during the first load, before Playwright can attach.
    win.webContents.on('console-message', (event) => {
      if (event.level === 'error') {
        console.error(`[verify-template-dev:renderer] ${event.message} (${event.sourceId}:${event.lineNumber})`)
      }
    })
    void win.loadURL(devServerUrl).then(
      () => console.log(`[verify-template-dev:loaded] ${win.webContents.getURL()}`),
      (error) => console.error('[verify-template-dev:renderer]', error),
    )
    return
  }

  void win.loadFile(rendererIndexPath)
}

app.whenReady().then(() => {
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
