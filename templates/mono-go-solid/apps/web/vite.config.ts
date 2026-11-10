import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import solid from 'vite-plugin-solid'

// https://vite.dev/config/
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    proxy: {
      '/api': `http://localhost:${process.env.PORT || '3000'}`,
    },
  },
})
