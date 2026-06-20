import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  // Electron loads the renderer via file:// in this template,
  // so built asset URLs must stay relative instead of root-absolute.
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
})
