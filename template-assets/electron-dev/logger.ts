const prefix = '[desktop:dev]'

export function log(message: string) {
  console.log(`${prefix} ${message}`)
}

export function logFailure(message: string, cause: unknown) {
  console.error(`${prefix} ${message}`)

  if (cause !== undefined) {
    console.error(cause)
  }
}
