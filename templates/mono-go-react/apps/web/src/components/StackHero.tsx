const stackItems = ['Go', 'net/http', 'React', 'Vite']

export function StackHero() {
  return (
    <section className="hero-card">
      <div className="eyebrow">Go + React</div>
      <h1>React meets the Go standard library</h1>
      <p className="lede">
        Vite runs the React app in development and forwards <code>/api</code> requests to Go. Build the frontend and
        backend separately or serve them from one Go binary.
      </p>
      <ul className="stack-list" aria-label="Stack">
        {stackItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
