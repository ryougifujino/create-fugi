import { cp, readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_NAME_PATTERN = /^[A-Za-z0-9._-]+$/

export interface TemplateEntry {
  name: string
  absolutePath: string
}

export async function listTemplates(templatesRootDir: string): Promise<TemplateEntry[]> {
  const entries = await readdir(templatesRootDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(templatesRootDir, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function validateProjectName(rawProjectName: string): string {
  const projectName = rawProjectName.trim()

  if (projectName.length === 0) {
    throw new Error('Project name is required.')
  }

  if (projectName === '.' || projectName === '..') {
    throw new Error('Project name cannot be "." or "..".')
  }

  if (/[\\/]/.test(projectName)) {
    throw new Error('Project name must be a single directory name.')
  }

  if (!PROJECT_NAME_PATTERN.test(projectName)) {
    throw new Error('Project name can only contain letters, numbers, dots, underscores, and hyphens.')
  }

  if (path.basename(projectName) !== projectName) {
    throw new Error('Project name must not include path traversal.')
  }

  return projectName
}

export async function ensureDirectoryDoesNotExist(targetDir: string): Promise<void> {
  try {
    await stat(targetDir)
    throw new Error(`Target directory already exists: ${targetDir}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }

    throw error
  }
}

export async function copyTemplate(templateDir: string, targetDir: string): Promise<void> {
  await cp(templateDir, targetDir, {
    recursive: true,
    errorOnExist: true,
    force: false,
  })
}
