import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./main.ts'],
  outDir: 'dist/main',
  external: ['electron'],
})
