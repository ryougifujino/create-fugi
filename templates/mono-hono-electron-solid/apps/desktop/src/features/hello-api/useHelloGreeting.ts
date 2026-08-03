import { createSignal } from 'solid-js'
import { defaultQuery, fetchGreeting } from './client'
import type { HelloQuery, HelloSuccess } from './client'

export function useHelloGreeting() {
  const [query, setQuery] = createSignal<HelloQuery>(defaultQuery)
  const [result, setResult] = createSignal<HelloSuccess | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [isLoading, setIsLoading] = createSignal(false)

  const setName = (name: string) => {
    setQuery({ name })
  }

  const submit = async () => {
    setIsLoading(true)

    try {
      const next = await fetchGreeting(query())
      setResult(next.data)
      setError(next.error)
    } catch (requestError) {
      setResult(null)
      setError(requestError instanceof Error ? requestError.message : 'Request failed.')
    } finally {
      setIsLoading(false)
    }
  }

  return {
    error,
    isLoading,
    query,
    result,
    setName,
    submit,
  }
}
