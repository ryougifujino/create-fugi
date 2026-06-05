import type { FormEvent } from 'react'
import { apiBaseUrl } from './client'
import { useHelloGreeting } from './useHelloGreeting'

export function HelloPlayground() {
  const { error, isLoading, query, result, setName, submit } = useHelloGreeting()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submit()
  }

  return (
    <section className="playground">
      <div className="panel">
        <h2>Call the API</h2>
        <p className="panel-copy">
          This form sends <code>GET /api/hello?name=...</code>. Try an empty value to hit the typed 400 response from
          the validator.
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
              placeholder="Hono Stack"
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Calling...' : 'Call /api/hello'}
          </button>
        </form>

        <dl className="meta-list">
          <div>
            <dt>Client base URL</dt>
            <dd>{apiBaseUrl}</dd>
          </div>
          <div>
            <dt>Request type</dt>
            <dd>
              <code>InferRequestType&lt;typeof $hello&gt;['query']</code>
            </dd>
          </div>
          <div>
            <dt>Response types</dt>
            <dd>
              <code>InferResponseType&lt;typeof $hello, 200 | 400&gt;</code>
            </dd>
          </div>
        </dl>
      </div>

      <div className="panel response-panel">
        <h2>Response</h2>
        <p className="panel-copy">
          The payload shown below comes from the typed Hono client and follows the shared route definition in{' '}
          <code>packages/api/src/index.ts</code>.
        </p>

        {error ? <p className="status error">{error}</p> : null}

        {result ? (
          <div className="response-card">
            <p className="message">{result.message}</p>
            <div className="chips" aria-label="Returned stack values">
              {result.stack.map((item: string) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <p className="timestamp">{result.timestamp}</p>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        ) : (
          <p className="status neutral">Submit the form to load a response.</p>
        )}
      </div>
    </section>
  )
}
