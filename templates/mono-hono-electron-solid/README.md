# mono-hono-electron-solid

## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the Hono server and the Electron desktop workflow in parallel.

The template includes a small Hono Stack example:

- `packages/api/src/index.ts` exposes `GET /api/hello` and exports `AppType`.
- `apps/server/src/index.ts` imports `@mono-hono-electron-solid/api` and runs it on the Node server.
- `apps/desktop/src/App.tsx` imports `AppType` from `@mono-hono-electron-solid/api` and calls the route through `hc`.
- The renderer defaults to `http://localhost:3000` and can be overridden with `VITE_API_BASE_URL`.

## Available Scripts

From the workspace root, you can run:

### `pnpm dev`

Starts the full development workflow.<br>
The renderer runs on Vite with HMR, Electron restarts automatically after
Electron bundle rebuilds, and the backend runs with `tsx watch`.

### `pnpm dev:desktop`

Runs only the Electron desktop workflow.

### `pnpm dev:server`

Runs only the Hono backend on [http://localhost:3000](http://localhost:3000).

### `pnpm build`

Builds both workspace apps for production.

### `pnpm start`

Starts the built Hono server.

### `pnpm dist`

Builds the desktop app and packages distributable installers into
`apps/desktop/release/`. The packaged app does not bundle the Hono server —
point `VITE_API_BASE_URL` at a reachable server before building.