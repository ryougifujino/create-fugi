# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and Oxlint checks.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Linting and formatting

Oxlint runs its built-in TypeScript and React rules:

```bash
pnpm lint
pnpm lint:fix
```

Oxfmt formats the project and sorts Tailwind CSS classes:

```bash
pnpm fmt
pnpm fmt:check
```

Adjust `.oxlintrc.json` or `.oxfmtrc.json` to customize either tool.