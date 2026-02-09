**English** | [简体中文](./README.zh-CN.md) | [日本語](./README.ja-JP.md)

# create-fugi 

This repository provides opinionated project templates.  
The goal of this repository is to provide templates with constraints and quality checks as complete as possible.

## Template Naming Principle (Convention over Configuration)

Template names should express only the major differences.  
Anything not explicitly in the name follows the default conventions.

Examples:

- `react`: single-package React frontend template.
- `mono-react-hono`: monorepo full-stack template with React frontend and Hono backend.
- Other primary differences (for example, `electron`) can be reflected in template names when needed.

## Constraints and Checks

| Item                        | Default                                          | Constraint / Purpose                                                     |
| --------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| EditorConfig                | `.editorconfig`                                  | 2-space indent, UTF-8, LF, trim trailing whitespace (Markdown excluded). |
| `.nvmrc`                    | `24`                                             | Pins the local Node.js major version.                                    |
| `package.json#engines`      | `node >=24.0.0`                                  | Enforces runtime compatibility.                                          |
| `packageManager` (Corepack) | `pnpm@10.28.2`                                   | Use Corepack to keep package manager version consistent.                 |
| ESLint                      | `eslint.config.js`                               | Lints JS/TS with `--max-warnings=0`.                                     |
| Prettier                    | `.prettierrc.json`                               | Unified formatting rules.                                                |
| Stylelint                   | `.stylelintrc.cjs` + `stylelint-config-standard` | Lints CSS/SCSS, including Tailwind at-rule allowances.                   |
| `tsc --noEmit`              | `pnpm typecheck`                                 | Type-safety gate without generating build output.                        |
| lefthook                    | `lefthook.yml`                                   | Runs Git hooks like `pre-commit` and `commit-msg`.                       |
| lint-staged                 | `lint-staged` in `package.json`                  | Lints/formats staged files only.                                         |
| commitlint                  | `@commitlint/config-conventional`                | Enforces Conventional Commits on commit messages.                        |

## Use a Template

Run one of the following commands:

```bash
pnpm create fugi
npm create fugi@latest
yarn create fugi
bun create fugi
```

Then follow the prompts to choose a template and project name.

## License

MIT
