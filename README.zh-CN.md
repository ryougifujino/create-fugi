[English](./README.md) | **简体中文** | [日本語](./README.ja-JP.md)

# create-fugi

本仓库提供一组有明确约定的项目模板。  
本仓库的宗旨是提供尽可能完善的约束与检查工具模板。

## 模板命名原则（约定大于配置）

模板名只体现“主要不同点”。  
没有写在名字里的内容，默认都按统一约定处理。

示例：

- `cli`：单包 Node.js 命令行工具模板（TypeScript）。
- `react`：单包 React 前端模板。
- `mono-go-react`：React 前端与 Go 后端的 monorepo，可将前端嵌入 Go 二进制文件。
- `mono-go-solid`：Solid 前端与 Go 后端的 monorepo，可将前端嵌入 Go 二进制文件。
- `mono-hono-react`：monorepo 全栈模板，前端 React，后端 Hono。
- 其他主要差异（比如 `electron`）也可以在模板名中体现。

## 约束与检查

模板生成的项目需要 Node.js 26 或更新版本。

| 项                           | 默认值                                           | 约束 / 作用                                        |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| EditorConfig                 | `.editorconfig`                                  | 2 空格缩进、UTF-8、LF、去尾空格（Markdown 除外）。 |
| `.nvmrc`                     | `26`                                             | 指定本地开发、CI 和 npm 发布使用的 Node.js 版本。  |
| `package.json#engines`       | `node >=24.0.0`                                  | 声明 CLI 所需的最低 Node.js 版本。                 |
| `packageManager`（Corepack） | `pnpm@12.18.0`                                   | 通过 Corepack 固定包管理器版本。                   |
| Oxlint                       | `.oxlintrc.json`                                 | 以 error 级别执行 JS/TS correctness 检查。         |
| Oxfmt                        | `.oxfmtrc.json`                                  | 统一代码格式并排序 Tailwind CSS class。            |
| Stylelint                    | `.stylelintrc.cjs` + `stylelint-config-standard` | CSS/SCSS 规范检查，包含 Tailwind at-rule 白名单。  |
| `tsc --noEmit`               | `pnpm typecheck`                                 | 仅做类型检查，不产出构建文件。                     |
| lefthook                     | `lefthook.yml`                                   | 管理 `pre-commit`、`commit-msg` 等 Git Hooks。     |
| lint-staged                  | `package.json` 中 `lint-staged`                  | 仅检查/格式化已暂存文件。                          |
| commitlint                   | `@commitlint/config-conventional`                | 提交信息遵循 Conventional Commits。                |

`mono-electron-solid` 通过 Oxlint 的 JS-plugin 兼容层执行 `eslint-plugin-solid`，以保留 Solid 专项规则。
其 ESLint peer 仅作为兼容 runtime；所有 lint 命令仍由 Oxlint 执行。

## 使用模板

执行以下任一命令：

```bash
pnpm create fugi
npm create fugi@latest
yarn create fugi
bun create fugi
```

然后按照交互提示选择模板和项目名。

### 非交互创建

同时指定项目名和 `--template`（简写为 `-t`），即可跳过提示并创建新目录。

```bash
pnpm create fugi my-tool --template cli
```

用 `.` 可以直接在当前目录生成。目录名会用作项目名，须使用 kebab-case。当前目录应为空，可以保留已有的 Git 元数据。

```bash
pnpm create fugi . --template react
```

### 启动生成的项目

在生成的项目目录中先运行 `pnpm install`，再运行 `pnpm dev`。如果选择了 `cli` 模板，运行 `pnpm dev hello Ada` 即可看到 `Hello, Ada!`。

## 维护 Electron 模板

共享开发脚本位于 [`template-assets/electron-dev/`](./template-assets/electron-dev/)。模板的 `apps/desktop/package.json` 将 `scripts.dev` 设为 `node ./scripts/dev/index.ts` 后，构建就会把共享文件复制到该模板的 `apps/desktop/scripts/dev/`，供 npm 打包使用。直接在仓库里的模板运行 `pnpm dev` 前，先在仓库根目录执行 `pnpm build`。`pnpm verify-template-dev` 也会在启动模板前同步脚本。

## License

MIT