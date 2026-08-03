import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import * as z from 'zod'

export const app = new Hono()

app.use(
  '/api/*',
  cors({
    // The desktop renderer runs on a dynamically chosen localhost port in dev
    // and on a file:// (null) origin in the packaged app, so reflect the
    // request origin instead of pinning a single one.
    origin: (origin) => origin,
  }),
)

const api = app.basePath('/api')

const helloQuerySchema = z.object({
  name: z.string().trim().min(1, 'Please enter a name.'),
})

export const helloRoute = api.get(
  '/hello',
  zValidator('query', helloQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          ok: false as const,
          error: result.error.issues[0]?.message ?? 'Invalid query.',
        },
        400,
      )
    }
  }),
  (c) => {
    const { name } = c.req.valid('query')

    return c.json(
      {
        ok: true as const,
        message: `Hello, ${name}!`,
        stack: ['Hono', 'Zod', 'hc'],
        timestamp: new Date().toISOString(),
      },
      200,
    )
  },
)

app.get('/', (c) => {
  return c.text('Hono server is running. Try GET /api/hello?name=Hono')
})

export type AppType = typeof helloRoute
