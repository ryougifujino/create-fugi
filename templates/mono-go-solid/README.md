# mono-go-solid

Solid and Vite provide the frontend. Go's standard `net/http` package serves the JSON API.

## Requirements

- Go 1.27.1 or newer
- Node.js 26 or newer and pnpm

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to Go on port 3000. Set `PORT` in the environment before starting both apps to use a different Go port.

Run `pnpm dev:web` or `pnpm dev:server` to start an app on its own. Vite hot-reloads the frontend. Air rebuilds and restarts the Go API when a Go file under `apps/server` changes. The first run downloads the pinned Air version through Go.

The example page calls `GET /api/hello?name=Go` with `fetch`. The server validates the name and returns JSON. The frontend declares its request and response types in TypeScript.

Use `pnpm fmt` to format the workspace and `pnpm fmt:check` to check formatting. Both commands use `gofmt` for Go files. The pre-commit hook formats staged Go files.

## Separate frontend and API

```bash
pnpm build
pnpm start
```

Deploy `apps/web/dist` to a static host and run the API binary in `apps/server/dist/api`. Configure the frontend host to proxy `/api/*` to Go so the browser can keep using relative URLs. To preview this setup locally, run `pnpm preview` while the API is running.

## Single Go binary

```bash
pnpm build:embed
./apps/server/dist/embed/server
```

On Windows, run `apps/server/dist/embed/server.exe`.

The build embeds the Vite output in the Go binary, which serves both the frontend and API from [http://localhost:3000](http://localhost:3000). Use `PORT` to change the listen port.