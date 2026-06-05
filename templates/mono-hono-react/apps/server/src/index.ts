import { serve } from '@hono/node-server'
import { app } from '@mono-hono-react/api'

const port = Number(process.env.PORT ?? '3000')

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
