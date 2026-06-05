# mono-hono-react

## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the React frontend on Vite and the Hono server in parallel.

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
