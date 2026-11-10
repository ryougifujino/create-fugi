import { Show } from 'solid-js'
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
          This form sends <code>GET /api/hello?name=...</code>. Try an empty value to see how Go validates the request.
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
              placeholder="Go Stack"
            />
          </label>

          <button type="submit" disabled={isLoading()}>
            {isLoading() ? 'Calling...' : 'Call /api/hello'}
          </button>
        </form>
      </div>

      <div class="panel">
        <h2>Response</h2>
        <p class="panel-copy">The Go API returns a JSON greeting or a validation error.</p>

        <div role="status">
          <Show
            when={error()}
            fallback={
              <Show when={result()} fallback={<p class="status neutral">Submit the form to load a response.</p>}>
                {(current) => (
                  <div class="response-card">
                    <p class="message">{current().message}</p>
                    <pre>{JSON.stringify(current(), null, 2)}</pre>
                  </div>
                )}
              </Show>
            }
          >
            {(message) => <p class="status error">{message()}</p>}
          </Show>
        </div>
      </div>
    </section>
  )
}
