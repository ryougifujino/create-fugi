import { For } from 'solid-js'

const stackItems = ['Go', 'net/http', 'Solid', 'Vite']

export function StackHero() {
  return (
    <section class="hero-card">
      <div class="eyebrow">Go + Solid</div>
      <h1>Solid meets the Go standard library</h1>
      <p class="lede">
        Vite runs the Solid app in development and forwards <code>/api</code> requests to Go. Build the frontend and
        backend separately or serve them from one Go binary.
      </p>
      <ul class="stack-list" aria-label="Stack">
        <For each={stackItems}>{(item) => <li>{item}</li>}</For>
      </ul>
    </section>
  )
}
