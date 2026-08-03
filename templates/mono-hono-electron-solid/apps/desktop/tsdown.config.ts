import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./main.ts'],
  outDir: 'dist/main',
  deps: {
    neverBundle: ['electron'],
  },
})
