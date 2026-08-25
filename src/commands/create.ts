import { execFile } from 'node:child_process'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { select } from '@inquirer/prompts'
import {
  applyProjectNameTemplate,
  copyTemplate,
  ensureDirectoryDoesNotExist,
  ensureDirectoryIsEmpty,
  listTemplates,
  resolveProjectTarget,
  restoreTemplateGitignore,
  type TemplateEntry,
} from '../lib/templates.ts'
import { promptProjectName } from '../prompts/project-name.ts'

const execFileAsync = promisify(execFile)

type RunGitCommand = (args: string[], options?: { cwd?: string }) => Promise<void>

export interface CreateCommandDependencies {
  projectName?: string
  templateName?: string
  cwd?: string
  log?: (message: string) => void
  promptTemplate?: (templates: TemplateEntry[]) => Promise<string>
  promptProjectName?: () => Promise<string>
  templatesRootDir?: string
  gitignoresRootDir?: string
  runGitCommand?: RunGitCommand
}

const runGitCommand: RunGitCommand = async (args, options) => {
  await execFileAsync('git', args, options)
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
      description: template.description,
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

  const selectedTemplateName = dependencies.templateName ?? (await selectTemplate(templates))
  const selectedTemplate = templates.find((template) => template.name === selectedTemplateName)

  if (selectedTemplate === undefined) {
    throw new Error(
      `Template "${selectedTemplateName}" is not available. Available templates: ${templates
        .map((template) => template.name)
        .join(', ')}`,
    )
  }

  const rawProjectName = dependencies.projectName ?? (await askProjectName())
  const { projectName, targetDir, isCurrentDir } = resolveProjectTarget(cwd, rawProjectName)

  if (isCurrentDir) {
    await ensureDirectoryIsEmpty(targetDir)
  } else {
    await ensureDirectoryDoesNotExist(targetDir)
  }

  await copyTemplate(selectedTemplate.absolutePath, targetDir, { allowExistingTarget: isCurrentDir })
  await restoreTemplateGitignore(targetDir, selectedTemplate.name, gitignoresRootDir)
  await applyProjectNameTemplate(targetDir, selectedTemplate.name, projectName)

  const hasGitRepository = await isGitRepository(targetDir)
  const gitInitialized =
    hasGitRepository || (await initializeGitRepository(targetDir, dependencies.runGitCommand ?? runGitCommand))

  log(`Project created at ${targetDir}`)

  const nextSteps: string[] = []

  if (!isCurrentDir) {
    nextSteps.push(`cd ${projectName}`)
  }

  if (!gitInitialized) {
    nextSteps.push('git init')
  }

  nextSteps.push('pnpm install', 'pnpm dev')
  log(`Next steps:\n${nextSteps.map((step) => `  ${step}`).join('\n')}`)
}

async function initializeGitRepository(targetDir: string, runGit: RunGitCommand): Promise<boolean> {
  try {
    await runGit(['--version'])
  } catch {
    return false
  }

  await runGit(['init'], { cwd: targetDir })
  return true
}

async function isGitRepository(targetDir: string): Promise<boolean> {
  try {
    const gitStats = await stat(path.join(targetDir, '.git'))
    return gitStats.isDirectory()
  } catch {
    return false
  }
}
