# @mono-hono-electron-solid/desktop

This package contains the Electron desktop app for the `mono-hono-electron-solid` workspace.

## Usage

Run from the workspace root:

```bash
pnpm dev
pnpm dev:desktop
```

`pnpm dev:desktop` starts the renderer on a Vite dev server, watches the
Electron bundle, and restarts Electron when Electron-side code changes.
Start the Hono backend too (or use `pnpm dev`) so the hello-api demo can
reach `http://localhost:3000`.

Tailwind CSS v4 is preconfigured for the renderer. Add utility classes in
`src/**/*.tsx` and extend global styles from `src/index.css`.

## Available Scripts

### `pnpm --filter @mono-hono-electron-solid/desktop dev:renderer`

Runs only the renderer dev server.

### `pnpm --filter @mono-hono-electron-solid/desktop build`

Builds the renderer and Electron bundle for production.

### `pnpm dist`

Builds the app and packages distributable installers with
[electron-builder](https://www.electron.build/) into `release/`.
Configuration lives in the `build` field of `package.json` — update
`appId` (and add icons) before shipping.

Renderer libraries (like `solid-js`) live in `devDependencies` because Vite
bundles them into `dist/renderer`, so they are not packaged again into the
app. Only main-process packages that must stay external at runtime (native
modules, anything listed in `neverBundle` of `tsdown.config.ts`) belong in
`dependencies` — electron-builder collects those from `node_modules`
automatically.

Learn more on the [Solid Website](https://solidjs.com) and the
[Electron Website](https://www.electronjs.org/).