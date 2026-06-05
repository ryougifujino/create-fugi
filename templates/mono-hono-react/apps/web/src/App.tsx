import { StackHero } from './components/StackHero'
import { HelloPlayground } from './features/hello-api/HelloPlayground'
import './App.css'

function App() {
  return (
    <main className="app-shell">
      <StackHero />
      <HelloPlayground />
    </main>
  )
}

export default App
