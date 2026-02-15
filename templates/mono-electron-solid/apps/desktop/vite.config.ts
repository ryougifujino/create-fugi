import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  // Electron loads renderer via file:// in this template,
  // so built asset URLs must stay relative instead of root-absolute.
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
})
