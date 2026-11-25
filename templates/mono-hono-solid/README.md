# mono-hono-solid

## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the Solid frontend on Vite and the Hono server in parallel.

The template includes a small Hono Stack example:

- `packages/api/src/index.ts` exposes `GET /api/hello` and exports `AppType`.
- `apps/server/src/index.ts` imports `@mono-hono-solid/api` and runs it on the Node server.
- `apps/web/src/features/hello-api/client.ts` imports `AppType` from `@mono-hono-solid/api` and calls the route through `hc`.
- The frontend defaults to `http://localhost:3000` and can be overridden with `VITE_API_BASE_URL`.

## Available Scripts

From the workspace root, you can run:

### `pnpm dev`

Starts the full development workflow.<br>
The frontend runs on Vite and the backend runs with `node --watch`.

### `pnpm dev:web`

Runs only the Solid frontend on [http://localhost:5173](http://localhost:5173).

### `pnpm dev:server`

Runs only the Hono backend on [http://localhost:3000](http://localhost:3000).

### `pnpm build`

Builds both workspace apps for production.

### `pnpm preview`

Previews the frontend build on [http://localhost:4173](http://localhost:4173). Run `pnpm start` separately to try the API.

### `pnpm start`

Starts the built Hono server.