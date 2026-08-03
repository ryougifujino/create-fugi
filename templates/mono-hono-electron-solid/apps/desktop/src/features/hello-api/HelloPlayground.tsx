import { For, Show } from 'solid-js'
import { apiBaseUrl } from './client'
import { useHelloGreeting } from './useHelloGreeting'

export function HelloPlayground() {
  const { error, isLoading, query, result, setName, submit } = useHelloGreeting()

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault()
    await submit()
  }

  return (
    <section class="playground">
      <div class="panel">
        <h2>Call the API</h2>
        <p class="panel-copy">
          This form sends <code>GET /api/hello?name=...</code>. Try an empty value to hit the typed 400 response from
          the validator.
        </p>

        <form class="api-form" onSubmit={handleSubmit}>
          <label class="field">
            <span>Name</span>
            <input
              type="text"
              value={query().name}
              onInput={(event) => {
                setName(event.currentTarget.value)
              }}
              placeholder="Hono Stack"
            />
          </label>

          <button type="submit" disabled={isLoading()}>
            {isLoading() ? 'Calling...' : 'Call /api/hello'}
          </button>
        </form>

        <dl class="meta-list">
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

      <div class="panel response-panel">
        <h2>Response</h2>
        <p class="panel-copy">
          The payload shown below comes from the typed Hono client and follows the shared route definition in{' '}
          <code>packages/api/src/index.ts</code>.
        </p>

        <Show when={error()}>
          <p class="status error">{error()}</p>
        </Show>

        <Show when={result()} fallback={<p class="status neutral">Submit the form to load a response.</p>}>
          {(current) => (
            <div class="response-card">
              <p class="message">{current().message}</p>
              <div class="chips" aria-label="Returned stack values">
                <For each={current().stack}>{(item) => <span>{item}</span>}</For>
              </div>
              <p class="timestamp">{current().timestamp}</p>
              <pre>{JSON.stringify(current(), null, 2)}</pre>
            </div>
          )}
        </Show>
      </div>
    </section>
  )
}
