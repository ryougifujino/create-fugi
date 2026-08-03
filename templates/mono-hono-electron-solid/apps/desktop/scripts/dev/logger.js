const prefix = '[desktop:dev]'

export function log(message) {
  console.log(`${prefix} ${message}`)
}

export function logFailure(message, cause) {
  console.error(`${prefix} ${message}`)

  if (cause !== undefined) {
    console.error(cause)
  }
}
