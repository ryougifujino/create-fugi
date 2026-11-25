[English](./README.md) | [简体中文](./README.zh-CN.md) | **日本語**

# create-fugi

このリポジトリは、明確な規約を持つプロジェクトテンプレートを提供します。  
このリポジトリの目的は、可能な限り充実した制約とチェックツールを備えたテンプレートを提供することです。

## テンプレート命名原則（Convention over Configuration）

テンプレート名には「主要な差分」だけを含めます。  
名前に書かれていない要素は、デフォルト規約が適用されます。

例:

- `cli`: シングルパッケージの Node.js CLI テンプレート（TypeScript）。
- `react`: シングルパッケージの React フロントエンドテンプレート。
- `solid`: シングルパッケージの Solid フロントエンドテンプレート。
- `mono-go-react`: React フロントエンドと Go バックエンドの monorepo。フロントエンドは Go バイナリに埋め込み可能。
- `mono-go-solid`: Solid フロントエンドと Go バックエンドの monorepo。フロントエンドは Go バイナリに埋め込み可能。
- `mono-hono-react`: monorepo のフルスタックテンプレート（React + Hono）。
- `mono-hono-solid`: monorepo のフルスタックテンプレート（Solid + Hono）。
- ほかの主要差分（例: `electron`）も、必要に応じてテンプレート名で表現します。

## 制約とチェック

CLI と生成されるプロジェクトには Node.js 26 以上が必要です。

| 項目                         | デフォルト                                       | 制約 / 目的                                            |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| EditorConfig                 | `.editorconfig`                                  | 2 スペース、UTF-8、LF、末尾空白削除（Markdown 除く）。 |
| `.nvmrc`                     | `26`                                             | ローカル開発、CI、npm 公開で使う Node.js を指定。      |
| `package.json#engines`       | `node >=26.0.0`                                  | CLI に必要な Node.js の最小バージョンを指定。          |
| `packageManager`（Corepack） | `pnpm@12.18.0`                                   | Corepack でパッケージマネージャーの版を固定。          |
| Oxlint                       | `.oxlintrc.json`                                 | JS/TS の correctness チェックを error として実行。     |
| Oxfmt                        | `.oxfmtrc.json`                                  | コード整形と Tailwind CSS class の並びを統一。         |
| Stylelint                    | `.stylelintrc.cjs` + `stylelint-config-standard` | CSS/SCSS を検査し、Tailwind の at-rule を許可。        |
| `tsc --noEmit`               | `pnpm typecheck`                                 | 出力なしで型チェックのみ実行。                         |
| lefthook                     | `lefthook.yml`                                   | `pre-commit` / `commit-msg` の Git Hooks を管理。      |
| lint-staged                  | `package.json` の `lint-staged`                  | ステージ済みファイルのみ検査 / 整形。                  |
| commitlint                   | `@commitlint/config-conventional`                | Conventional Commits を強制。                          |

`mono-electron-solid` は Solid 固有ルールを維持するため、Oxlint の JS-plugin 互換レイヤー経由で
`eslint-plugin-solid` を実行します。ESLint peer は互換 runtime のみで、lint コマンドはすべて Oxlint を実行します。

## テンプレートの使い方

次のいずれかを実行します:

```bash
pnpm create fugi
npm create fugi@latest
yarn create fugi
bun create fugi
```

その後、対話プロンプトでテンプレートとプロジェクト名を選択します。

### 対話プロンプトなしで作成する

プロジェクト名と `--template`（短縮形は `-t`）を指定すると、対話プロンプトを省略して新しいディレクトリを作成できます。

```bash
pnpm create fugi my-tool --template cli
```

`.` を指定すると、現在のディレクトリに生成できます。ディレクトリ名をプロジェクト名として使うため、kebab-case にしてください。空のディレクトリで実行してください。既存の Git メタデータはそのままにできます。

```bash
pnpm create fugi . --template react
```

### 生成したプロジェクトを起動する

生成したプロジェクトのディレクトリで `pnpm install` を実行し、続けて `pnpm dev` を実行します。`cli` テンプレートの場合は `pnpm dev hello Ada` を実行すると、`Hello, Ada!` が表示されます。

## Electron テンプレートのメンテナンス

共有の開発スクリプトは [`template-assets/electron-dev/`](./template-assets/electron-dev/) で管理します。テンプレートの `apps/desktop/package.json` で `scripts.dev` を `node ./scripts/dev/index.ts` に設定すると、ビルド時に npm パッケージ用の共有ファイルがそのテンプレートの `apps/desktop/scripts/dev/` にコピーされます。このリポジトリ内のテンプレートで直接 `pnpm dev` を実行する前に、ルートで `pnpm build` を実行してください。`pnpm verify-template-dev` も起動前にスクリプトを同期します。

## License

MIT