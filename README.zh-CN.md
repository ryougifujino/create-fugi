[English](./README.md) | **简体中文** | [日本語](./README.ja-JP.md)

# create-fugi 

本仓库提供一组有明确约定的项目模板。  
本仓库的宗旨是提供尽可能完善的约束与检查工具模板。

## 模板命名原则（约定大于配置）

模板名只体现“主要不同点”。  
没有写在名字里的内容，默认都按统一约定处理。

示例：

- `react`：单包 React 前端模板。
- `mono-react-hono`：monorepo 全栈模板，前端 React，后端 Hono。
- 其他主要差异（比如 `electron`）也可以在模板名中体现。

## 约束与检查

| 项                           | 默认值                                           | 约束 / 作用                                        |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------- |
| EditorConfig                 | `.editorconfig`                                  | 2 空格缩进、UTF-8、LF、去尾空格（Markdown 除外）。 |
| `.nvmrc`                     | `24`                                             | 固定本地 Node.js 主版本。                          |
| `package.json#engines`       | `node >=24.0.0`                                  | 约束运行时兼容范围。                               |
| `packageManager`（Corepack） | `pnpm@10.28.2`                                   | 通过 Corepack 固定包管理器版本。                   |
| ESLint                       | `eslint.config.js`                               | JS/TS 代码检查，`--max-warnings=0`。               |
| Prettier                     | `.prettierrc.json`                               | 统一代码格式。                                     |
| Stylelint                    | `.stylelintrc.cjs` + `stylelint-config-standard` | CSS/SCSS 规范检查，包含 Tailwind at-rule 白名单。  |
| `tsc --noEmit`               | `pnpm typecheck`                                 | 仅做类型检查，不产出构建文件。                     |
| lefthook                     | `lefthook.yml`                                   | 管理 `pre-commit`、`commit-msg` 等 Git Hooks。     |
| lint-staged                  | `package.json` 中 `lint-staged`                  | 仅检查/格式化已暂存文件。                          |
| commitlint                   | `@commitlint/config-conventional`                | 提交信息遵循 Conventional Commits。                |

## 使用模板

执行以下任一命令：

```bash
pnpm create fugi
npm create fugi@latest
yarn create fugi
bun create fugi
```

然后按照交互提示选择模板和项目名。

## License

MIT
