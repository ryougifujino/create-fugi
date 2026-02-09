[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

# create-fugi 

このリポジトリは、明確な規約を持つプロジェクトテンプレートを提供します。  
このリポジトリの目的は、可能な限り充実した制約とチェックツールを備えたテンプレートを提供することです。

## テンプレート命名原則（Convention over Configuration）

テンプレート名には「主要な差分」だけを含めます。  
名前に書かれていない要素は、デフォルト規約が適用されます。

例:

- `react`: シングルパッケージの React フロントエンドテンプレート。
- `mono-react-hono`: monorepo のフルスタックテンプレート（React + Hono）。
- ほかの主要差分（例: `electron`）も、必要に応じてテンプレート名で表現します。

## 制約とチェック

| 項目                         | デフォルト                                       | 制約 / 目的                                            |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| EditorConfig                 | `.editorconfig`                                  | 2 スペース、UTF-8、LF、末尾空白削除（Markdown 除く）。 |
| `.nvmrc`                     | `24`                                             | ローカルの Node.js メジャーバージョンを固定。          |
| `package.json#engines`       | `node >=24.0.0`                                  | 実行環境の互換性を明示。                               |
| `packageManager`（Corepack） | `pnpm@10.28.2`                                   | Corepack でパッケージマネージャーの版を固定。          |
| ESLint                       | `eslint.config.js`                               | JS/TS の静的解析（`--max-warnings=0`）。               |
| Prettier                     | `.prettierrc.json`                               | コード整形ルールを統一。                               |
| Stylelint                    | `.stylelintrc.cjs` + `stylelint-config-standard` | CSS/SCSS を検査し、Tailwind の at-rule を許可。        |
| `tsc --noEmit`               | `pnpm typecheck`                                 | 出力なしで型チェックのみ実行。                         |
| lefthook                     | `lefthook.yml`                                   | `pre-commit` / `commit-msg` の Git Hooks を管理。      |
| lint-staged                  | `package.json` の `lint-staged`                  | ステージ済みファイルのみ検査 / 整形。                  |
| commitlint                   | `@commitlint/config-conventional`                | Conventional Commits を強制。                          |

## テンプレートの使い方

次のいずれかを実行します:

```bash
pnpm create fugi
npm create fugi@latest
yarn create fugi
bun create fugi
```

その後、対話プロンプトでテンプレートとプロジェクト名を選択します。

## License

MIT
