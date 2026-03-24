import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { select } from '@inquirer/prompts'
import {
  applyProjectNameTemplate,
  copyTemplate,
  ensureDirectoryDoesNotExist,
  listTemplates,
  restoreTemplateGitignore,
  type TemplateEntry,
  validateProjectName,
} from '../lib/templates.ts'
import { promptProjectName } from '../prompts/project-name.ts'

export interface CreateCommandDependencies {
  cwd?: string
  log?: (message: string) => void
  promptTemplate?: (templates: TemplateEntry[]) => Promise<string>
  promptProjectName?: () => Promise<string>
  templatesRootDir?: string
  gitignoresRootDir?: string
}

function resolveBundledTemplatesRootDir(): string {
  const commandDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(commandDir, '../../templates')
}

function resolveBundledGitignoresRootDir(): string {
  const commandDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(commandDir, '../../gitignores')
}

async function promptTemplateName(templates: TemplateEntry[]): Promise<string> {
  return select({
    message: 'Select a scaffold template',
    choices: templates.map((template) => ({
      name: template.name,
      value: template.name,
    })),
  })
}

export async function runCreateCommand(dependencies: CreateCommandDependencies = {}): Promise<void> {
  const log = dependencies.log ?? console.log
  const cwd = dependencies.cwd ?? process.cwd()
  const selectTemplate = dependencies.promptTemplate ?? promptTemplateName
  const askProjectName = dependencies.promptProjectName ?? promptProjectName

  const templatesRootDir = dependencies.templatesRootDir ?? resolveBundledTemplatesRootDir()
  const gitignoresRootDir = dependencies.gitignoresRootDir ?? resolveBundledGitignoresRootDir()
  log('Loading templates from local package...')

  const templates = await listTemplates(templatesRootDir)

  if (templates.length === 0) {
    throw new Error(`No templates found in templates directory: ${templatesRootDir}`)
  }

  const selectedTemplateName = await selectTemplate(templates)
  const selectedTemplate = templates.find((template) => template.name === selectedTemplateName)

  if (selectedTemplate === undefined) {
    throw new Error(`Template "${selectedTemplateName}" is not available.`)
  }

  const rawProjectName = await askProjectName()
  const projectName = validateProjectName(rawProjectName)
  const targetDir = path.resolve(cwd, projectName)

  await ensureDirectoryDoesNotExist(targetDir)
  await copyTemplate(selectedTemplate.absolutePath, targetDir)
  await restoreTemplateGitignore(targetDir, selectedTemplate.name, gitignoresRootDir)
  await applyProjectNameTemplate(targetDir, selectedTemplate.name, projectName)

  log(`Project created at ${targetDir}`)
  log(`Next steps:\n  cd ${projectName}`)
}
