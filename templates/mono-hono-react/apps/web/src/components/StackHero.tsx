const stackItems = ['Hono', 'Zod', 'hc', 'React']

export function StackHero() {
  return (
    <section className="hero-card">
      <div className="eyebrow">Hono Stack Demo</div>
      <h1>Type-safe API calls across the monorepo</h1>
      <p className="lede">
        The shared API package exports <code>AppType</code>. The React app consumes it with <code>hc</code>, so request
        params and response payloads stay in sync without codegen.
      </p>
      <ul className="stack-list" aria-label="Stack">
        {stackItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
