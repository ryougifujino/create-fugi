import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import solidTypescript from 'eslint-plugin-solid/configs/typescript'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/**/src/**/*.{ts,tsx}'],
    extends: [solidTypescript, eslintConfigPrettier],
  },
])
