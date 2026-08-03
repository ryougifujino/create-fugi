import { createPrompt, isEnterKey, makeTheme, useEffect, useKeypress, usePrefix, useState } from '@inquirer/core'
import { validateProjectNameInput } from '../lib/templates.ts'

export const PROJECT_NAME_PLACEHOLDER = 'fugi-project'

const ANSI_DIM = '\u001B[2m'
const ANSI_RESET = '\u001B[0m'

interface ReadlineBuffer {
  line: string
  cursor: number
}

export type PlaceholderKeystroke = { type: 'commit'; text: string } | { type: 'restore' } | { type: 'noop' }

// While the placeholder is shown, the readline buffer holds the placeholder text with the
// cursor at 0 so the terminal cursor sits on the first ghost character. Whatever readline
// did to that buffer, the only edit that leaves placeholder mode is an insertion at the
// cursor, which shows up as a new prefix before the untouched placeholder.
export function resolvePlaceholderKeystroke(buffer: ReadlineBuffer, placeholder: string): PlaceholderKeystroke {
  if (buffer.line.length > placeholder.length && buffer.line.endsWith(placeholder)) {
    return { type: 'commit', text: buffer.line.slice(0, buffer.line.length - placeholder.length) }
  }

  if (buffer.line === placeholder && buffer.cursor === 0) {
    return { type: 'noop' }
  }

  return { type: 'restore' }
}

// @inquirer/type omits the cursor property, but Node's readline interface always has it.
function asReadlineBuffer(rl: { line: string }): ReadlineBuffer {
  return rl as ReadlineBuffer
}

function setReadlineBuffer(rl: ReadlineBuffer, line: string, cursor: number): void {
  rl.line = line
  rl.cursor = cursor
}

export const projectNamePrompt = createPrompt<string, { message: string }>((config, done) => {
  const theme = makeTheme()
  const [status, setStatus] = useState<'idle' | 'done'>('idle')
  const [value, setValue] = useState('')
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string>()
  const [, setPlaceholderArmed] = useState(false)
  const prefix = usePrefix({ status, theme })

  useEffect((rl) => {
    setReadlineBuffer(asReadlineBuffer(rl), PROJECT_NAME_PLACEHOLDER, 0)
    // The first render ran with an empty buffer; re-render so the cursor lands on the ghost text.
    setPlaceholderArmed(true)
  }, [])

  useKeypress((key, rl) => {
    const buffer = asReadlineBuffer(rl)

    if (status !== 'idle') {
      return
    }

    if (isEnterKey(key)) {
      try {
        const projectName = validateProjectNameInput(showPlaceholder ? '' : value)
        setValue(projectName)
        setStatus('done')
        done(projectName)
      } catch (error) {
        // The line event cleared the buffer; restore it so the user can keep editing.
        if (showPlaceholder) {
          setReadlineBuffer(buffer, PROJECT_NAME_PLACEHOLDER, 0)
        } else {
          setReadlineBuffer(buffer, value, value.length)
        }
        setErrorMessage(error instanceof Error ? error.message : 'Invalid project name.')
      }
      return
    }

    setErrorMessage(undefined)

    if (showPlaceholder) {
      const keystroke = resolvePlaceholderKeystroke(buffer, PROJECT_NAME_PLACEHOLDER)

      if (keystroke.type === 'commit') {
        setReadlineBuffer(buffer, keystroke.text, keystroke.text.length)
        setShowPlaceholder(false)
        setValue(keystroke.text)
      } else if (keystroke.type === 'restore') {
        setReadlineBuffer(buffer, PROJECT_NAME_PLACEHOLDER, 0)
      }
      return
    }

    if (buffer.line.length === 0) {
      setReadlineBuffer(buffer, PROJECT_NAME_PLACEHOLDER, 0)
      setShowPlaceholder(true)
      setValue('')
      return
    }

    setValue(buffer.line)
  })

  const message = theme.style.message(config.message, status)

  if (status === 'done') {
    return `${prefix} ${message} ${theme.style.answer(value)}`
  }

  const displayValue = showPlaceholder ? `${ANSI_DIM}${PROJECT_NAME_PLACEHOLDER}${ANSI_RESET}` : value
  const errorLine = errorMessage === undefined ? undefined : theme.style.error(errorMessage)

  return [`${prefix} ${message} ${displayValue}`, errorLine]
})

export async function promptProjectName(): Promise<string> {
  return projectNamePrompt({ message: 'Project name' })
}
