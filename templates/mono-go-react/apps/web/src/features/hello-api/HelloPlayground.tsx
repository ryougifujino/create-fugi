import type { SubmitEvent } from 'react'
import { useHelloGreeting } from './useHelloGreeting'

export function HelloPlayground() {
  const { error, isLoading, query, result, setName, submit } = useHelloGreeting()

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submit()
  }

  return (
    <section className="playground">
      <div className="panel">
        <h2>Call the API</h2>
        <p className="panel-copy">
          This form sends <code>GET /api/hello?name=...</code>. Try an empty value to see how Go validates the request.
        </p>

        <form className="api-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={query.name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              placeholder="Go Stack"
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Calling...' : 'Call /api/hello'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Response</h2>
        <p className="panel-copy">The Go API returns a JSON greeting or a validation error.</p>

        <div role="status">
          {error ? (
            <p className="status error">{error}</p>
          ) : result ? (
            <div className="response-card">
              <p className="message">{result.message}</p>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
          ) : (
            <p className="status neutral">Submit the form to load a response.</p>
          )}
        </div>
      </div>
    </section>
  )
}
