import { cp, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const electronDevSourceDir = fileURLToPath(new URL('../template-assets/electron-dev', import.meta.url))
const desktopRelativePath = 'apps/desktop'
export const electronDevRelativePath = `${desktopRelativePath}/scripts/dev`

const templatesDir = fileURLToPath(new URL('../templates', import.meta.url))
const electronDevCommand = 'node ./scripts/dev/index.ts'

async function readDesktopManifest(templateDir: string): Promise<{ scripts?: { dev?: string } } | null> {
  const manifestPath = path.join(templateDir, desktopRelativePath, 'package.json')
  try {
    return JSON.parse(await readFile(manifestPath, 'utf-8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function listElectronDevTemplates(): Promise<string[]> {
  const entries = await readdir(templatesDir, { withFileTypes: true })
  const templates: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const manifest = await readDesktopManifest(path.join(templatesDir, entry.name))
    if (manifest?.scripts?.dev === electronDevCommand) {
      templates.push(entry.name)
    }
  }
  return templates.sort()
}

export async function syncElectronDevScripts(): Promise<void> {
  for (const template of await listElectronDevTemplates()) {
    const targetDir = path.join(templatesDir, template, electronDevRelativePath)
    // Remove stale copies when a shared module is renamed or deleted.
    await rm(targetDir, { recursive: true, force: true })
    await cp(electronDevSourceDir, targetDir, { recursive: true })
  }
}
