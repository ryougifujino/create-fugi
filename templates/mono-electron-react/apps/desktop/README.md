## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the renderer on a Vite dev server, watches the Electron
bundle, and restarts Electron when Electron-side code changes.

Tailwind CSS v4 is preconfigured for the renderer. Add utility classes in
`src/**/*.tsx` and extend global styles from `src/index.css`.

## Available Scripts

From the workspace root, you can run:

### `pnpm dev`

Starts the desktop development workflow.<br>
The renderer uses Vite HMR and Electron restarts automatically after Electron
bundle rebuilds.

### `pnpm --filter @mono-electron-react/desktop dev:renderer`

Runs only the renderer dev server.

### `pnpm --filter @mono-electron-react/desktop build`

Builds the renderer and Electron bundle for production.

### `pnpm dist`

Builds the app and packages distributable installers with
[electron-builder](https://www.electron.build/) into `release/`.
Configuration lives in the `build` field of `package.json` — update
`appId` (and add icons) before shipping.

Renderer libraries (like `react`) live in `devDependencies` because Vite
bundles them into `dist/renderer`, so they are not packaged again into the
app. Only main-process packages that must stay external at runtime (native
modules, anything listed in `neverBundle` of `tsdown.config.ts`) belong in
`dependencies` — electron-builder collects those from `node_modules`
automatically.

Learn more on the [React Website](https://react.dev) and the
[Electron Website](https://www.electronjs.org/).