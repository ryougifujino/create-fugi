# mono-go-react

React and Vite provide the frontend. Go's standard `net/http` package serves the JSON API.

## Requirements

- Go 1.22 or newer
- Node.js 24 or newer and pnpm

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to Go on port 3000. Set `PORT` in the environment before starting both apps to use a different Go port.

Run `pnpm dev:web` or `pnpm dev:server` to start an app on its own. Vite hot-reloads the frontend. Restart the Go process after changing Go source files.

The example page calls `GET /api/hello?name=Go` with `fetch`. The server validates the name and returns JSON. The frontend declares its request and response types in TypeScript.

## Separate frontend and API

```bash
pnpm build
pnpm start
```

Deploy `apps/web/dist` to a static host and run the API binary in `apps/server/dist/api`. Configure the frontend host to proxy `/api/*` to Go so the browser can keep using relative URLs. To preview this setup locally, run `pnpm preview` while the API is running.

## Single Go binary

```bash
pnpm build:embed
pnpm start:embed
```

This builds React first, then embeds the Vite output in the Go binary in `apps/server/dist/embed`. Run the binary directly to serve both the frontend and API from [http://localhost:3000](http://localhost:3000). Use `PORT` to change the listen port. This build uses the same API as the separate deployment.