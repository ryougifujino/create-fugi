import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react({ compiler: true }), tailwindcss()],
  // Electron loads the renderer via file:// in this template,
  // so built asset URLs must stay relative instead of root-absolute.
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
})
