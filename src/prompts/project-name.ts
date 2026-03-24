import { clearLine, clearScreenDown, cursorTo, emitKeypressEvents, moveCursor } from 'node:readline'
import { input } from '@inquirer/prompts'
import { validateProjectName } from '../lib/templates.ts'

export const PROJECT_NAME_PLACEHOLDER = 'fugi-project'

const PROJECT_NAME_PROMPT_LABEL = '? Project name '

const ANSI_DIM = '\u001B[2m'
const ANSI_CYAN = '\u001B[36m'
const ANSI_GREEN = '\u001B[32m'
const ANSI_RED = '\u001B[31m'
const ANSI_RESET = '\u001B[0m'

const STYLED_PROJECT_NAME_PROMPT_LABEL = `${ANSI_CYAN}?${ANSI_RESET} Project name `
const STYLED_PROJECT_NAME_DONE_LABEL = `${ANSI_GREEN}✔${ANSI_RESET} Project name `

export interface ProjectNamePromptState {
  value: string
  cursor: number
  showPlaceholder: boolean
  error?: string
}

export type ProjectNamePromptAction =
  | { type: 'input'; text: string }
  | { type: 'left' }
  | { type: 'right' }
  | { type: 'home' }
  | { type: 'end' }
  | { type: 'backspace' }
  | { type: 'delete' }
  | { type: 'set-error'; message?: string }

export function renderProjectNameInput(value: string, isFinal: boolean): string {
  if (value.length > 0 || isFinal) {
    return value
  }

  return `${ANSI_DIM}${PROJECT_NAME_PLACEHOLDER}${ANSI_RESET}`
}

export function createProjectNamePromptState(): ProjectNamePromptState {
  return {
    value: PROJECT_NAME_PLACEHOLDER,
    cursor: 0,
    showPlaceholder: true,
  }
}

export function getProjectNamePromptValue(state: ProjectNamePromptState): string {
  return state.showPlaceholder ? '' : state.value
}

function createEmptyProjectNamePromptState(): ProjectNamePromptState {
  return createProjectNamePromptState()
}

export function reduceProjectNamePromptState(
  state: ProjectNamePromptState,
  action: ProjectNamePromptAction,
): ProjectNamePromptState {
  if (action.type === 'set-error') {
    return {
      ...state,
      error: action.message,
    }
  }

  if (state.showPlaceholder) {
    if (action.type === 'input' && action.text.length > 0) {
      return {
        value: action.text,
        cursor: action.text.length,
        showPlaceholder: false,
      }
    }

    return {
      ...state,
      error: undefined,
    }
  }

  const clearError = (nextState: ProjectNamePromptState): ProjectNamePromptState => ({
    ...nextState,
    error: undefined,
  })

  if (action.type === 'input') {
    if (action.text.length === 0) {
      return state
    }

    const nextValue = state.value.slice(0, state.cursor) + action.text + state.value.slice(state.cursor)

    return clearError({
      ...state,
      value: nextValue,
      cursor: state.cursor + action.text.length,
    })
  }

  if (action.type === 'left') {
    return clearError({
      ...state,
      cursor: Math.max(0, state.cursor - 1),
    })
  }

  if (action.type === 'right') {
    return clearError({
      ...state,
      cursor: Math.min(state.value.length, state.cursor + 1),
    })
  }

  if (action.type === 'home') {
    return clearError({
      ...state,
      cursor: 0,
    })
  }

  if (action.type === 'end') {
    return clearError({
      ...state,
      cursor: state.value.length,
    })
  }

  if (action.type === 'backspace') {
    if (state.cursor === 0) {
      return clearError(state)
    }

    const nextValue = state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor)
    if (nextValue.length === 0) {
      return createEmptyProjectNamePromptState()
    }

    return clearError({
      ...state,
      value: nextValue,
      cursor: state.cursor - 1,
    })
  }

  if (action.type === 'delete') {
    if (state.cursor >= state.value.length) {
      return clearError(state)
    }

    const nextValue = state.value.slice(0, state.cursor) + state.value.slice(state.cursor + 1)
    if (nextValue.length === 0) {
      return createEmptyProjectNamePromptState()
    }

    return clearError({
      ...state,
      value: nextValue,
    })
  }

  return state
}

async function promptProjectNameWithInquirer(): Promise<string> {
  return input({
    message: 'Project name',
    transformer: (value, { isFinal }) => renderProjectNameInput(value, isFinal),
    validate: (value) => {
      try {
        validateProjectName(value)
        return true
      } catch (error) {
        if (error instanceof Error) {
          return error.message
        }
        return 'Invalid project name.'
      }
    },
  })
}

function isPrintableKeypress(sequence: string, key: { ctrl?: boolean; meta?: boolean }): boolean {
  if (sequence.length === 0 || key.ctrl === true || key.meta === true) {
    return false
  }

  return Array.from(sequence).every((character) => {
    const codePoint = character.codePointAt(0)

    if (codePoint === undefined) {
      return false
    }

    return codePoint >= 0x20 && codePoint !== 0x7f
  })
}

function renderProjectNamePromptState(state: ProjectNamePromptState): void {
  const displayValue = state.showPlaceholder ? `${ANSI_DIM}${state.value}${ANSI_RESET}` : state.value

  cursorTo(process.stdout, 0)
  clearLine(process.stdout, 0)
  clearScreenDown(process.stdout)
  process.stdout.write(`${STYLED_PROJECT_NAME_PROMPT_LABEL}${displayValue}`)

  if (state.error !== undefined) {
    process.stdout.write(`\n${ANSI_RED}> ${state.error}${ANSI_RESET}`)
    moveCursor(process.stdout, 0, -1)
  }

  cursorTo(process.stdout, PROJECT_NAME_PROMPT_LABEL.length + state.cursor)
}

export async function promptProjectName(): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return promptProjectNameWithInquirer()
  }

  return new Promise<string>((resolve, reject) => {
    const initialRawMode = process.stdin.isRaw === true
    let state = createProjectNamePromptState()

    const cleanup = (): void => {
      process.stdin.off('keypress', onKeypress)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(initialRawMode)
      }
      process.stdin.pause()
    }

    const finish = (projectName: string): void => {
      cursorTo(process.stdout, 0)
      clearLine(process.stdout, 0)
      clearScreenDown(process.stdout)
      process.stdout.write(`${STYLED_PROJECT_NAME_DONE_LABEL}${projectName}\n`)
      cleanup()
      resolve(projectName)
    }

    const fail = (error: unknown): void => {
      cleanup()
      reject(error)
    }

    const submit = (): void => {
      try {
        const projectName = validateProjectName(getProjectNamePromptValue(state))
        finish(projectName)
      } catch (error) {
        state = reduceProjectNamePromptState(state, {
          type: 'set-error',
          message: error instanceof Error ? error.message : 'Invalid project name.',
        })
        renderProjectNamePromptState(state)
      }
    }

    const onKeypress = (sequence: string, key: { ctrl?: boolean; meta?: boolean; name?: string }): void => {
      if (key.ctrl === true && key.name === 'c') {
        const promptError = new Error('User force closed the prompt with SIGINT')
        promptError.name = 'ExitPromptError'
        fail(promptError)
        return
      }

      if (key.name === 'return' || key.name === 'enter') {
        submit()
        return
      }

      if (key.name === 'left') {
        state = reduceProjectNamePromptState(state, { type: 'left' })
      } else if (key.name === 'right') {
        state = reduceProjectNamePromptState(state, { type: 'right' })
      } else if (key.name === 'home' || (key.ctrl === true && key.name === 'a')) {
        state = reduceProjectNamePromptState(state, { type: 'home' })
      } else if (key.name === 'end' || (key.ctrl === true && key.name === 'e')) {
        state = reduceProjectNamePromptState(state, { type: 'end' })
      } else if (key.name === 'backspace') {
        state = reduceProjectNamePromptState(state, { type: 'backspace' })
      } else if (key.name === 'delete') {
        state = reduceProjectNamePromptState(state, { type: 'delete' })
      } else if (isPrintableKeypress(sequence, key)) {
        state = reduceProjectNamePromptState(state, {
          type: 'input',
          text: sequence,
        })
      } else {
        return
      }

      renderProjectNamePromptState(state)
    }

    emitKeypressEvents(process.stdin)
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('keypress', onKeypress)
    renderProjectNamePromptState(state)
  })
}
