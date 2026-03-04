import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
    throw new Error('Project name must be kebab-case using lowercase letters, numbers, and single hyphens.')
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

export async function applyProjectNameTemplate(
  targetDir: string,
  templateName: string,
  projectName: string,
): Promise<void> {
  await customizeDirectory(targetDir, templateName, projectName)
}

async function customizeDirectory(targetDir: string, templateName: string, projectName: string): Promise<void> {
  const entries = await readdir(targetDir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      await customizeDirectory(entryPath, templateName, projectName)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (entry.name === 'package.json') {
      await customizePackageJson(entryPath, templateName, projectName)
      continue
    }

    if (entry.name === 'index.html') {
      await customizeHtmlTitle(entryPath, templateName, projectName)
      continue
    }

    if (entry.name.endsWith('.md')) {
      await customizeMarkdown(entryPath, templateName, projectName)
    }
  }
}

async function customizePackageJson(filePath: string, templateName: string, projectName: string): Promise<void> {
  const packageJson = await readFile(filePath, 'utf-8')
  const parsedPackageJson = JSON.parse(packageJson) as unknown
  const rewrittenPackageJson = rewriteJsonValue(parsedPackageJson, templateName, projectName)

  if (JSON.stringify(parsedPackageJson) === JSON.stringify(rewrittenPackageJson)) {
    return
  }

  await writeFile(filePath, `${JSON.stringify(rewrittenPackageJson, null, 2)}\n`)
}

async function customizeHtmlTitle(filePath: string, templateName: string, projectName: string): Promise<void> {
  const html = await readFile(filePath, 'utf-8')
  const titlePattern = new RegExp(`<title>(\\s*)${escapeRegExp(templateName)}(\\s*)</title>`, 'g')
  const updatedHtml = html.replace(titlePattern, `<title>$1${projectName}$2</title>`)

  if (updatedHtml === html) {
    return
  }

  await writeFile(filePath, updatedHtml)
}

async function customizeMarkdown(filePath: string, templateName: string, projectName: string): Promise<void> {
  const markdown = await readFile(filePath, 'utf-8')
  const updatedMarkdown = rewriteTemplateReference(markdown, templateName, projectName)

  if (updatedMarkdown === markdown) {
    return
  }

  await writeFile(filePath, updatedMarkdown)
}

function rewriteJsonValue(value: unknown, templateName: string, projectName: string): unknown {
  if (typeof value === 'string') {
    return rewriteTemplateReference(value, templateName, projectName)
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteJsonValue(item, templateName, projectName))
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rewriteJsonValue(item, templateName, projectName)]),
    )
  }

  return value
}

function rewriteTemplateReference(value: string, templateName: string, projectName: string): string {
  if (value === templateName) {
    return projectName
  }

  return value.replaceAll(`@${templateName}/`, `@${projectName}/`)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
