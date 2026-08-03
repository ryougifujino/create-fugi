import { cp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TEMPLATE_GITIGNORE_SUFFIX = '_gitignore'
const CURRENT_DIRECTORY_TOKEN = '.'
const IGNORED_TARGET_DIRECTORY_ENTRIES = new Set(['.git', '.DS_Store'])
const SOURCE_FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])

export interface TemplateEntry {
  name: string
  absolutePath: string
  description?: string
}

// Kept in the CLI on purpose: a description inside a template's package.json
// would be copied into every scaffolded project.
const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  react: 'Single-package React frontend (Vite)',
  'mono-node': 'Monorepo with a Node.js app',
  'mono-hono-react': 'Monorepo with a React frontend and a Hono backend',
  'mono-electron-react': 'Monorepo with an Electron + React desktop app',
  'mono-electron-solid': 'Monorepo with an Electron + Solid desktop app',
  'mono-hono-electron-react': 'Monorepo with an Electron + React desktop app and a Hono backend',
  'mono-hono-electron-solid': 'Monorepo with an Electron + Solid desktop app and a Hono backend',
}

export async function listTemplates(templatesRootDir: string): Promise<TemplateEntry[]> {
  const entries = await readdir(templatesRootDir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(templatesRootDir, entry.name),
      description: TEMPLATE_DESCRIPTIONS[entry.name],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export interface ProjectTarget {
  projectName: string
  targetDir: string
  isCurrentDir: boolean
}

export function validateProjectNameInput(rawProjectName: string): string {
  const projectName = rawProjectName.trim()

  if (projectName === CURRENT_DIRECTORY_TOKEN) {
    return projectName
  }

  return validateProjectName(rawProjectName)
}

export function resolveProjectTarget(cwd: string, rawProjectName: string): ProjectTarget {
  const trimmedProjectName = rawProjectName.trim()

  if (trimmedProjectName === CURRENT_DIRECTORY_TOKEN) {
    const currentDirName = path.basename(cwd)

    try {
      validateProjectName(currentDirName)
    } catch (error) {
      throw new Error(
        `Current directory name "${currentDirName}" cannot be used as the project name: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { cause: error },
      )
    }

    return {
      projectName: currentDirName,
      targetDir: cwd,
      isCurrentDir: true,
    }
  }

  const projectName = validateProjectName(trimmedProjectName)

  return {
    projectName,
    targetDir: path.resolve(cwd, projectName),
    isCurrentDir: false,
  }
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

export async function ensureDirectoryIsEmpty(targetDir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(targetDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return
    }

    throw error
  }

  const blockingEntries = entries.filter((entry) => !IGNORED_TARGET_DIRECTORY_ENTRIES.has(entry))

  if (blockingEntries.length > 0) {
    throw new Error(`Current directory is not empty: ${targetDir}`)
  }
}

export async function copyTemplate(templateDir: string, targetDir: string): Promise<void> {
  await cp(templateDir, targetDir, {
    recursive: true,
    errorOnExist: true,
    force: false,
  })
}

export async function restoreTemplateGitignore(
  targetDir: string,
  templateName: string,
  gitignoresRootDir: string,
): Promise<void> {
  const sourcePath = path.join(gitignoresRootDir, `${templateName}${TEMPLATE_GITIGNORE_SUFFIX}`)

  let gitignoreContent: string
  try {
    gitignoreContent = await readFile(sourcePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Missing generated gitignore for template "${templateName}": ${sourcePath}. Run "pnpm build" to regenerate gitignores.`,
        { cause: error },
      )
    }

    throw error
  }

  await writeFile(path.join(targetDir, '.gitignore'), gitignoreContent)
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
      continue
    }

    if (SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      await customizeScopedReferences(entryPath, templateName, projectName)
    }
  }
}

async function customizeScopedReferences(filePath: string, templateName: string, projectName: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const updatedContent = content.replaceAll(`@${templateName}/`, `@${projectName}/`)

  if (updatedContent === content) {
    return
  }

  await writeFile(filePath, updatedContent)
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
  const updatedMarkdown = rewriteMarkdownReferences(markdown, templateName, projectName)

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
    // Keys are only rewritten in scoped form (e.g. dependency names like "@template/api").
    // A bare key equal to the template name (e.g. the "react" dependency in the react
    // template) is a real package name and must stay untouched.
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replaceAll(`@${templateName}/`, `@${projectName}/`),
        rewriteJsonValue(item, templateName, projectName),
      ]),
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

function rewriteMarkdownReferences(value: string, templateName: string, projectName: string): string {
  const scopedRewritten = value.replaceAll(`@${templateName}/`, `@${projectName}/`)
  // Bare references like "# mono-hono-react" must not match inside larger tokens
  // such as "plugin-react", "react.dev", or "@vitejs/plugin-react".
  const barePattern = new RegExp(`(?<![A-Za-z0-9@/._-])${escapeRegExp(templateName)}(?![A-Za-z0-9/._-])`, 'g')

  return scopedRewritten.replace(barePattern, projectName)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
