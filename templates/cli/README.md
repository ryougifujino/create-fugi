# cli

A Node.js command-line tool written in TypeScript. Requires Node.js 26 or newer.

```sh
pnpm install
pnpm dev hello Ada
pnpm dev --help
pnpm test
pnpm build
```

Add commands under `src/commands/` and register them in `src/cli.ts`.
The build emits `dist/index.js`, which is exposed as the `cli` command when the package is installed.
Use `pnpm pack` to build and package the tool for local installation.