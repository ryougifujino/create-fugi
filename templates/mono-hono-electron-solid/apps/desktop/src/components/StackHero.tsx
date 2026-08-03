import { For } from 'solid-js'

const stackItems = ['Hono', 'Zod', 'hc', 'Solid', 'Electron']

export function StackHero() {
  return (
    <section class="hero-card">
      <div class="eyebrow">Hono Stack Demo</div>
      <h1>Type-safe API calls across the monorepo</h1>
      <p class="lede">
        The shared API package exports <code>AppType</code>. The Solid app consumes it with <code>hc</code>, so request
        params and response payloads stay in sync without codegen.
      </p>
      <ul class="stack-list" aria-label="Stack">
        <For each={stackItems}>{(item) => <li>{item}</li>}</For>
      </ul>
    </section>
  )
}
