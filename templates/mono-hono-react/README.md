# mono-hono-react

## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the React frontend on Vite and the Hono server in parallel.

The template includes a small Hono Stack example:

- `packages/api/src/index.ts` exposes `GET /api/hello` and exports `AppType`.
- `apps/server/src/index.ts` imports `@mono-hono-react/api` and runs it on the Node server.
- `apps/web/src/App.tsx` imports `AppType` from `@mono-hono-react/api` and calls the route through `hc`.
- The frontend defaults to `http://localhost:3000` and can be overridden with `VITE_API_BASE_URL`.

## Available Scripts

From the workspace root, you can run:

### `pnpm dev`

Starts the full development workflow.<br>
The frontend runs on Vite and the backend runs with `tsx watch`.

### `pnpm dev:web`

Runs only the React frontend on [http://localhost:5173](http://localhost:5173).

### `pnpm dev:server`

Runs only the Hono backend on [http://localhost:3000](http://localhost:3000).

### `pnpm build`

Builds both workspace apps for production.

### `pnpm preview`

Previews the frontend build only.

### `pnpm start`

Starts the built Hono server.
