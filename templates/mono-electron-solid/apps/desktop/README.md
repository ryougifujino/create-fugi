## Usage

```bash
$ pnpm install
$ pnpm dev
```

`pnpm dev` starts the renderer on a Vite dev server, watches the Electron
bundle, and restarts Electron when Electron-side code changes.

## Available Scripts

From the workspace root, you can run:

### `pnpm dev`

Starts the desktop development workflow.<br>
The renderer uses Vite HMR and Electron restarts automatically after Electron
bundle rebuilds.

### `pnpm --filter @mono-electron-solid/desktop dev:renderer`

Runs only the renderer dev server.

### `pnpm build`

Builds the renderer and Electron bundle for production.

Learn more on the [Solid Website](https://solidjs.com) and the
[Electron Website](https://www.electronjs.org/).
