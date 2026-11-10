# @mono-go-react/web

This package contains the React frontend for the `mono-go-react` workspace.

## Usage

Run from the workspace root:

```bash
pnpm dev
pnpm --filter @mono-go-react/web dev
```

The Vite dev server runs on [http://localhost:5173](http://localhost:5173) by default. It forwards `/api` to the Go server on
`http://localhost:3000` by default. Set `PORT` before starting both apps to change the backend port.