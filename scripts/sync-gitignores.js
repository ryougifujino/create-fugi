import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRootDir = path.resolve(scriptDir, '..')
const templatesRootDir = path.join(projectRootDir, 'templates')
const gitignoresRootDir = path.join(projectRootDir, 'gitignores')
const TEMPLATE_GITIGNORE_NAME = '.gitignore'
const GENERATED_GITIGNORE_SUFFIX = '_gitignore'

const templateEntries = await readdir(templatesRootDir, { withFileTypes: true })
const templateNames = templateEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b))

if (templateNames.length === 0) {
  throw new Error(`No template directories found: ${templatesRootDir}`)
}

await mkdir(gitignoresRootDir, { recursive: true })

for (const templateName of templateNames) {
  const sourcePath = path.join(templatesRootDir, templateName, TEMPLATE_GITIGNORE_NAME)
  const targetPath = path.join(gitignoresRootDir, `${templateName}${GENERATED_GITIGNORE_SUFFIX}`)
  const gitignoreContent = await readFile(sourcePath, 'utf-8')
  await writeFile(targetPath, gitignoreContent)
}
