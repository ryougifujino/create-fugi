export type HelloQuery = {
  name: string
}

export type HelloSuccess = {
  ok: true
  message: string
  timestamp: string
}

type HelloFailure = {
  ok: false
  error: string
}

export const defaultQuery: HelloQuery = {
  name: 'Go Stack',
}

export async function fetchGreeting(query: HelloQuery): Promise<HelloSuccess> {
  const params = new URLSearchParams(query)
  const response = await fetch(`/api/hello?${params}`)

  if (response.status === 400) {
    const data: HelloFailure = await response.json()
    throw new Error(data.error)
  }

  if (!response.ok) {
    throw new Error(`Request failed (HTTP ${response.status}).`)
  }

  return response.json()
}
