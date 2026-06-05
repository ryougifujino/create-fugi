import type { AppType } from '@mono-hono-react/api'
import { hc } from 'hono/client'
import type { InferRequestType, InferResponseType } from 'hono/client'

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

const client = hc<AppType>(apiBaseUrl)
const $hello = client.api.hello.$get

export type HelloQuery = InferRequestType<typeof $hello>['query']
export type HelloSuccess = InferResponseType<typeof $hello, 200>
type HelloFailure = InferResponseType<typeof $hello, 400>

export const defaultQuery: HelloQuery = {
  name: 'Hono Stack',
}

export async function fetchGreeting(query: HelloQuery) {
  const response = await $hello({ query })

  if (response.ok) {
    const data: HelloSuccess = await response.json()
    return { data, error: null }
  }

  const failure: HelloFailure = await response.json()
  return { data: null, error: failure.error }
}
